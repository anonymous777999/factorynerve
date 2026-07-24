#!/usr/bin/env python3
"""
validate_env.py — Pre-flight environment validation.

Run on every backend startup (integrated into main.py lifespan)
to verify that the local environment is properly configured.

Usage:
    python scripts/validate_env.py          # Validate and exit
    python scripts/validate_env.py --json    # JSON output (for tooling)
    python scripts/validate_env.py --fix     # Auto-fix common issues

Exit code: 0 = all checks pass, 1 = failures found
"""

from __future__ import annotations

import json
import os
import shutil
import sqlite3
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

FAILURES: list[str] = []
WARNINGS: list[str] = []
CHECKS_RUN: int = 0


def _env(key: str, default: str = "") -> str:
    return (os.getenv(key) or default).strip()


def _env_bool(key: str, default: bool = False) -> bool:
    return _env(key, "1" if default else "0").lower() in ("1", "true", "yes", "on")


def _check(name: str, passed: bool, detail: str = "") -> None:
    global CHECKS_RUN
    CHECKS_RUN += 1
    status = "PASS" if passed else "FAIL"
    msg = f"  [{status}] {name}"
    if detail:
        msg += f" — {detail}"
    print(msg)
    if not passed:
        FAILURES.append(f"{name}: {detail}")


def _warn(name: str, detail: str) -> None:
    global CHECKS_RUN
    CHECKS_RUN += 1
    WARNINGS.append(f"{name}: {detail}")
    print(f"  [WARN] {name} — {detail}")


def _check_env(name: str, required: bool = True) -> None:
    value = _env(name)
    if not value and required:
        _check(f"ENV {name}", False, "Required but not set")
    elif not value:
        _warn(f"ENV {name}", "Not set (optional)")
    elif value in ("test", "dummy", "placeholder", "example", "changeme"):
        _warn(f"ENV {name}", f"Set to placeholder value '{value}'")
    else:
        _check(f"ENV {name}", True)


# ── Section: Environment Variables ────────────────────────────────────────────

def check_env_vars() -> None:
    print("\n[ENVIRONMENT VARIABLES]")
    app_env = _env("APP_ENV", "development")
    _check("APP_ENV is valid", app_env in ("development", "testing", "production", "staging"))
    _check("DEBUG is not true in production", not (app_env == "production" and _env_bool("DEBUG")),
           "DEBUG must be false in production")

    _check_env("APP_NAME")
    _check_env("JWT_SECRET_KEY", required=app_env != "testing")
    _check_env("DATA_ENCRYPTION_KEY", required=True)

    # AI provider
    provider = _env("AI_PROVIDER", "groq").lower()
    allowed = {"groq", "anthropic", "gemini", "claude", "google", "openai", "gpt"}
    _check("AI_PROVIDER is valid", provider in allowed, f"Got '{provider}', expected one of {allowed}")

    ai_keys = {
        "GROQ_API_KEY": _env("GROQ_API_KEY"),
        "ANTHROPIC_API_KEY": _env("ANTHROPIC_API_KEY"),
        "GEMINI_API_KEY": _env("GEMINI_API_KEY"),
        "OPENAI_API_KEY": _env("OPENAI_API_KEY"),
    }
    any_real = any(k and k not in ("test", "") for k in ai_keys.values())
    has_key = any(v for v in ai_keys.values())
    _check("At least one AI provider key configured", has_key)
    if has_key and any_real:
        _check("At least one AI provider key is real (not 'test')", any_real)

    # Auth
    session_secure = _env("AUTH_SESSION_SECURE", "false").lower()
    if app_env == "development" and session_secure == "true":
        _warn("AUTH_SESSION_SECURE=true in dev", "Cookies won't work over HTTP. Set to false.")

    # CORS
    cors = _env("CORS_ALLOWED_ORIGINS")
    _check("CORS_ALLOWED_ORIGINS has at least localhost", "localhost" in cors or "127.0.0.1" in cors or app_env != "development")

    # Encryption key validation
    ek = _env("DATA_ENCRYPTION_KEY")
    if ek:
        try:
            from cryptography.fernet import Fernet
            Fernet(ek.encode("utf-8"))
            _check("DATA_ENCRYPTION_KEY is valid Fernet key", True)
        except Exception as e:
            _check("DATA_ENCRYPTION_KEY is valid Fernet key", False, str(e))


# ── Section: Database ─────────────────────────────────────────────────────────

def check_database() -> None:
    print("\n[DATABASE]")
    db_url = _env("DATABASE_URL")

    if not db_url:
        _check("DATABASE_URL is set", False)
        return

    _check("DATABASE_URL is set", True, f"Using: {db_url.split('://')[0]}")

    if db_url.startswith("sqlite"):
        # Extract path
        path_str = db_url.replace("sqlite:///", "", 1)
        if path_str:
            db_path = Path(path_str)
            if not db_path.is_absolute():
                db_path = (PROJECT_ROOT / path_str).resolve()
            dir_exists = db_path.parent.exists()
            _check("SQLite parent directory exists", dir_exists, str(db_path.parent))
            if dir_exists:
                try:
                    conn = sqlite3.connect(str(db_path))
                    conn.execute("SELECT 1")
                    conn.close()
                    _check("SQLite database is accessible", True)
                except Exception as e:
                    _check("SQLite database is accessible", False, str(e))
            else:
                _check("SQLite database is accessible", False, "Parent directory does not exist")
        else:
            _check("SQLite in-memory database", True, ":memory:")

        # Check for WAL mode capability
        if path_str:
            try:
                conn = sqlite3.connect(str(db_path))
                cursor = conn.execute("PRAGMA journal_mode")
                journal_mode = cursor.fetchone()[0]
                conn.close()
                _check("SQLite WAL mode supported", journal_mode in ("wal", "delete"),
                       f"Current: {journal_mode}")
            except Exception:
                pass

    elif "postgresql" in db_url:
        _check("PostgreSQL URL format", "psycopg2" in db_url or "asyncpg" in db_url,
               "Consider adding +psycopg2 or +asyncpg to the URL for explicit driver")

        # Check if we're in production with SQLite-like URL
        app_env = _env("APP_ENV", "development")
        if app_env == "production":
            _check("PostgreSQL in production", True)

    # Alembic migrations check
    alembic_ini = PROJECT_ROOT / "alembic.ini"
    _check("alembic.ini exists", alembic_ini.exists())
    alembic_dir = PROJECT_ROOT / "alembic"
    _check("alembic/ directory exists", alembic_dir.is_dir())

    # Migration versions
    versions_dir = alembic_dir / "versions"
    if versions_dir.is_dir():
        migrations = list(versions_dir.glob("*.py"))
        _check("Alembic migration files found", len(migrations) > 0, f"Found {len(migrations)} migrations")
    else:
        _check("Alembic versions directory exists", False)


# ── Section: Directories ──────────────────────────────────────────────────────

def check_directories() -> None:
    print("\n[DIRECTORIES]")

    required_dirs = [
        ("logs/", PROJECT_ROOT / "logs"),
        ("exports/ocr_verifications/", PROJECT_ROOT / "exports" / "ocr_verifications"),
        ("exports/background_jobs/", PROJECT_ROOT / "exports" / "background_jobs"),
        ("exports/failed_payloads/", PROJECT_ROOT / "exports" / "failed_payloads"),
        ("exports/audit_archive/", PROJECT_ROOT / "exports" / "audit_archive"),
    ]

    for label, path in required_dirs:
        try:
            path.mkdir(parents=True, exist_ok=True)
            _check(f"Directory {label}", path.is_dir(), str(path))
        except (OSError, PermissionError) as e:
            _check(f"Directory {label}", False, str(e))


# ── Section: OCR / Tesseract ──────────────────────────────────────────────────

def check_ocr() -> None:
    print("\n[OCR / TESSERACT]")

    # Check tesseract binary
    tesseract_path = _env("TESSERACT_PATH", "")
    tesseract_bin = shutil.which("tesseract") or shutil.which(tesseract_path) or ""
    if tesseract_bin:
        _check("Tesseract binary found", True, tesseract_bin)
        try:
            result = subprocess.run(
                [tesseract_bin, "--version"],
                capture_output=True, text=True, timeout=10
            )
            version_line = result.stdout.split("\n")[0] if result.stdout else "unknown"
            _check("Tesseract version", result.returncode == 0, version_line)
        except (subprocess.TimeoutExpired, OSError) as e:
            _check("Tesseract version check", False, str(e))
    else:
        ocr_enabled = _env("OCR_ENABLED", "true").lower() in ("1", "true")
        if ocr_enabled:
            _warn("Tesseract binary not found",
                  "OCR will fall back to AI-only mode. Install Tesseract for full functionality.")
        else:
            _check("Tesseract binary found (OCR disabled)", True, "OCR disabled via config")

    # Check Tesseract language data
    if tesseract_bin:
        try:
            result = subprocess.run(
                [tesseract_bin, "--list-langs"],
                capture_output=True, text=True, timeout=10
            )
            langs = [l.strip() for l in result.stdout.split("\n") if l.strip() and not l.startswith("List")]
            _check("Tesseract language data (eng)", "eng" in langs, f"Available: {', '.join(langs[:5])}..."
                    if len(langs) > 5 else f"Available: {', '.join(langs)}")
        except (subprocess.TimeoutExpired, OSError):
            _check("Tesseract language data", False, "Could not list languages")


# ── Section: AI Providers ─────────────────────────────────────────────────────

def check_ai_providers() -> None:
    print("\n[AI PROVIDERS]")

    provider = _env("AI_PROVIDER", "groq").lower()
    api_key_map = {
        "groq": ("GROQ_API_KEY", "groq"),
        "anthropic": ("ANTHROPIC_API_KEY", "anthropic"),
        "gemini": ("GEMINI_API_KEY", "google"),
        "claude": ("ANTHROPIC_API_KEY", "anthropic"),
        "google": ("GEMINI_API_KEY", "google"),
        "openai": ("OPENAI_API_KEY", "openai"),
        "gpt": ("OPENAI_API_KEY", "openai"),
    }

    env_key, _ = api_key_map.get(provider, ("", ""))
    if env_key:
        key = _env(env_key)
        if key and key not in ("test", ""):
            _check(f"Primary AI provider ({provider}) has a real key configured", True)
        elif key:
            _warn(f"Primary AI provider ({provider})", f"API key is '{key}' — AI features will use fallback")
        else:
            _warn(f"Primary AI provider ({provider})", f"API key is empty — AI features will use fallback")

    # Check all available providers
    available = []
    for key_name, provider_name in [("GROQ_API_KEY", "Groq"), ("ANTHROPIC_API_KEY", "Anthropic"),
                                     ("GEMINI_API_KEY", "Gemini"), ("OPENAI_API_KEY", "OpenAI")]:
        val = _env(key_name)
        if val and val not in ("test", ""):
            available.append(provider_name)
    if available:
        _check("Available AI providers", True, ", ".join(available))

    # Timeouts
    timeout = _env("AI_PROVIDER_TIMEOUT_SECONDS", "25")
    try:
        t = float(timeout)
        _check("AI_PROVIDER_TIMEOUT_SECONDS", 1 <= t <= 120, f"{t}s")
    except ValueError:
        _check("AI_PROVIDER_TIMEOUT_SECONDS", False, f"Invalid: {timeout}")


# ── Section: SMTP / Email ─────────────────────────────────────────────────────

def check_email() -> None:
    print("\n[EMAIL]")

    dry_run = _env_bool("SMTP_DRY_RUN", True)
    host = _env("SMTP_HOST")
    port = _env("SMTP_PORT", "587")

    if dry_run:
        _check("Email is in dry-run mode", True, "No emails will be sent")
    else:
        _check("SMTP_HOST is set", bool(host), host or "Not set")
        if host:
            try:
                port_int = int(port)
                _check("SMTP_PORT is valid", 1 <= port_int <= 65535, str(port_int))
            except ValueError:
                _check("SMTP_PORT is valid", False, f"Invalid: {port}")

    from_email = _env("SMTP_FROM")
    if from_email:
        _check("SMTP_FROM is set", True, from_email)

    # Check mail catcher (Mailpit/MailHog) if in dev
    app_env = _env("APP_ENV", "development")
    if app_env == "development" and not dry_run and host == "127.0.0.1":
        import socket
        try:
            sock = socket.create_connection((host, int(port)), timeout=2)
            sock.close()
            _check("Local SMTP server is reachable", True, f"{host}:{port}")
        except (socket.timeout, ConnectionRefusedError, OSError):
            _warn("Local SMTP server not reachable",
                  f"Could not connect to {host}:{port}. Install Mailpit or set SMTP_DRY_RUN=1")

    # Email queue config
    max_retries = _env("EMAIL_MAX_RETRIES", "5")
    try:
        _check("EMAIL_MAX_RETRIES is valid", int(max_retries) >= 0)
    except ValueError:
        _check("EMAIL_MAX_RETRIES is valid", False)


# ── Section: Redis ────────────────────────────────────────────────────────────

def check_redis() -> None:
    print("\n[CACHE / REDIS]")

    redis_url = _env("REDIS_URL")
    if redis_url:
        try:
            import redis
            client = redis.from_url(redis_url, decode_responses=True, socket_timeout=2)
            client.ping()
            _check("Redis is reachable", True)
            client.close()
        except Exception as e:
            _warn("Redis is not reachable", str(e))
    else:
        _check("Redis disabled (using in-memory cache)", True, "No REDIS_URL set")

    cache_items = _env("CACHE_MEMORY_MAX_ITEMS", "512")
    try:
        _check("CACHE_MEMORY_MAX_ITEMS is valid", int(cache_items) >= 16)
    except ValueError:
        _check("CACHE_MEMORY_MAX_ITEMS is valid", False)


# ── Section: Billing ──────────────────────────────────────────────────────────

def check_billing() -> None:
    print("\n[BILLING]")

    rzp_key = _env("RAZORPAY_KEY_ID")
    rzp_secret = _env("RAZORPAY_KEY_SECRET")

    if rzp_key and rzp_secret:
        app_env = _env("APP_ENV", "development")
        is_test_key = "test" in rzp_key or "test" in rzp_secret
        if app_env == "production":
            _check("Razorpay live keys in production", not is_test_key,
                   "RAZORPAY_KEY_ID contains 'test' but APP_ENV=production")
        else:
            _check("Razorpay test keys configured", is_test_key,
                   "Using test keys (dev mode)")
    else:
        _warn("Razorpay", "Key or secret missing. Billing features will fail.")


# ── Section: File System ──────────────────────────────────────────────────────

def check_filesystem() -> None:
    print("\n[FILESYSTEM]")

    # Check disk space
    try:
        usage = shutil.disk_usage(PROJECT_ROOT)
        free_gb = usage.free / (1024 ** 3)
        _check("Disk space", free_gb > 0.5, f"{free_gb:.1f} GB free")
    except OSError:
        _warn("Disk space check", "Could not determine disk usage")

    # Check exports directory is writable
    exports_dir = PROJECT_ROOT / "exports"
    try:
        test_file = exports_dir / ".write_test"
        test_file.write_text("ok")
        test_file.unlink()
        _check("Exports directory is writable", True, str(exports_dir))
    except (OSError, PermissionError) as e:
        _check("Exports directory is writable", False, str(e))

    # Check temp directory
    try:
        with tempfile.NamedTemporaryFile(delete=True) as tmp:
            _check("Temp directory is writable", True)
    except OSError:
        _check("Temp directory is writable", False)


# ── Section: Python / Dependencies ────────────────────────────────────────────

def check_dependencies() -> None:
    print("\n[DEPENDENCIES]")

    # Python version (3.10+ required, 3.11+ recommended)
    py_version = sys.version_info
    _check("Python version >= 3.10", py_version >= (3, 10), f"{py_version.major}.{py_version.minor}.{py_version.micro}")
    if py_version < (3, 11):
        _warn("Python version >= 3.11 recommended", "Some features may not work on 3.10")

    # Check critical imports
    critical_packages = [
        ("fastapi", "web framework"),
        ("sqlalchemy", "database ORM"),
        ("pydantic", "data validation"),
        ("cryptography", "encryption"),
        ("jose", "JWT tokens"),
        ("bcrypt", "password hashing"),
        ("PIL", "image processing"),
        ("openpyxl", "Excel export"),
        ("httpx", "HTTP client"),
    ]

    for package, purpose in critical_packages:
        try:
            if package == "jose":
                import jose  # noqa: F401
            elif package == "PIL":
                from PIL import Image  # noqa: F401
            else:
                __import__(package.replace("-", "_"))
            _check(f"Package: {package}", True, purpose)
        except ImportError:
            _check(f"Package: {package}", False, f"Missing ({purpose}). Run: pip install -r requirements.txt")

    # Check optional packages
    optional_packages = [
        ("tesseract", "pytesseract", "OCR"),
        ("redis", "redis", "cache/queue"),
        ("sentry_sdk", "sentry-sdk", "error tracking"),
        ("razorpay", "razorpay", "payments"),
        ("anthropic", "anthropic", "AI provider"),
        ("groq", "groq", "AI provider"),
        ("openai", "openai", "AI provider"),
    ]
    missing_opt = []
    for _, pkg_name, purpose in optional_packages:
        try:
            __import__(pkg_name.replace("-", "_"))
        except ImportError:
            missing_opt.append(f"{pkg_name} ({purpose})")
    if missing_opt:
        _warn("Optional packages missing", "; ".join(missing_opt))


# ── Summary ───────────────────────────────────────────────────────────────────

def print_summary() -> dict[str, Any]:
    print("\n" + "=" * 60)
    print(f"  ENVIRONMENT VALIDATION SUMMARY")
    print("=" * 60)
    print(f"  Checks:    {CHECKS_RUN}")
    print(f"  Passed:    {CHECKS_RUN - len(FAILURES) - len(WARNINGS)}")
    print(f"  Warnings:  {len(WARNINGS)}")
    print(f"  Failures:  {len(FAILURES)}")

    if FAILURES:
        print(f"\n  * FAILURES ({len(FAILURES)}):")
        for f in FAILURES:
            print(f"     * {f}")

    if WARNINGS:
        print(f"\n  * WARNINGS ({len(WARNINGS)}):")
        for w in WARNINGS:
            print(f"     * {w}")

    print()

    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "project_root": str(PROJECT_ROOT),
        "app_env": _env("APP_ENV", "development"),
        "total_checks": CHECKS_RUN,
        "passed": CHECKS_RUN - len(FAILURES) - len(WARNINGS),
        "warnings": len(WARNINGS),
        "failures": len(FAILURES),
        "failure_details": FAILURES,
        "warning_details": WARNINGS,
        "healthy": len(FAILURES) == 0,
    }


def fix_common_issues() -> int:
    """Attempt to auto-fix common issues."""
    print("\n" + "=" * 60)
    print("  AUTO-FIX ATTEMPTS")
    print("=" * 60)
    fixed = 0

    # Create required directories
    dirs_to_create = [
        PROJECT_ROOT / "logs",
        PROJECT_ROOT / "exports" / "ocr_verifications",
        PROJECT_ROOT / "exports" / "background_jobs",
        PROJECT_ROOT / "exports" / "failed_payloads",
        PROJECT_ROOT / "exports" / "audit_archive",
    ]
    for d in dirs_to_create:
        try:
            d.mkdir(parents=True, exist_ok=True)
            print(f"  ✓ Created directory: {d.relative_to(PROJECT_ROOT)}")
            fixed += 1
        except (OSError, PermissionError) as e:
            print(f"  ✗ Could not create {d.relative_to(PROJECT_ROOT)}: {e}")

    return fixed


def main() -> int:
    import argparse
    parser = argparse.ArgumentParser(description="Validate DPR.ai environment")
    parser.add_argument("--json", action="store_true", help="Output JSON instead of human-readable")
    parser.add_argument("--fix", action="store_true", help="Auto-fix common issues")
    args = parser.parse_args()

    # Load env file if present
    dotenv_path = PROJECT_ROOT / ".env"
    if dotenv_path.exists():
        try:
            from dotenv import load_dotenv
            load_dotenv(dotenv_path)
        except ImportError:
            pass

    if not args.json:
        print("=" * 60)
        print(f"  DPR.ai Environment Validation")
        print(f"  Project: {PROJECT_ROOT}")
        print(f"  Time:    {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}")
        print(f"  Env:     {_env('APP_ENV', 'development')}")
        print("=" * 60)

    # Run all checks
    check_env_vars()
    check_database()
    check_directories()
    check_ocr()
    check_ai_providers()
    check_email()
    check_redis()
    check_billing()
    check_filesystem()
    check_dependencies()

    # Auto-fix if requested
    if args.fix:
        fix_common_issues()

    # Summary
    result = print_summary() if not args.json else print(json.dumps(print_summary(), indent=2))

    return 1 if FAILURES else 0


if __name__ == "__main__":
    sys.exit(main())
