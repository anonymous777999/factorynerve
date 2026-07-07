#!/usr/bin/env python3
"""Pre-flight deployment checklist.

Run this script before any production deployment to verify that all
recent changes are properly configured and ready for release.

Usage:
    python scripts/deployment_checklist.py
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

FAILURES: list[str] = []
WARNINGS: list[str] = []


def check(description: str, condition: bool, failure_msg: str = "") -> None:
    if condition:
        print(f"  [PASS] {description}")
    else:
        msg = failure_msg or f"Check failed: {description}"
        FAILURES.append(msg)
        print(f"  [FAIL] {msg}")


def warn(description: str, msg: str) -> None:
    WARNINGS.append(msg)
    print(f"  [WARN] {description}: {msg}")


# ── D-15: Cold Start Elimination ─────────────────────────────────────────────
def check_d15() -> None:
    print("\n[D-15] Cold Start Elimination")
    render_yaml = PROJECT_ROOT / "render.yaml"
    check("render.yaml exists", render_yaml.exists())
    if render_yaml.exists():
        content = render_yaml.read_text()
        check(
            "plan set to starter",
            "plan: starter" in content,
            "render.yaml still has 'plan: free'. Change to 'plan: starter'.",
        )
        check(
            "minInstances: 1 set",
            "minInstances: 1" in content,
            "render.yaml missing 'minInstances: 1'. Add under the web service.",
        )


# ── D-18: Redis-Backed Role Revision Cache ────────────────────────────────────
def check_d18() -> None:
    print("\n[D-18] Role Revision Cache")
    main_py = PROJECT_ROOT / "backend" / "main.py"
    security_py = PROJECT_ROOT / "backend" / "security.py"
    pdp_py = PROJECT_ROOT / "backend" / "authorization" / "pdp.py"

    if main_py.exists():
        content = main_py.read_text()
        check(
            "main.py imports from backend.cache",
            "from backend.cache import" in content,
            "main.py missing backend.cache import.",
        )
        check(
            "No legacy _ROLE_REVISION_LOCK",
            "_ROLE_REVISION_LOCK" not in content,
            "Dead _ROLE_REVISION_LOCK still present in main.py.",
        )
        check(
            "No legacy _ROLE_REVISION_CACHE dict",
            "_ROLE_REVISION_CACHE: dict" not in content,
            "Old in-memory dict cache still present in main.py.",
        )

    if security_py.exists():
        content = security_py.read_text()
        check(
            "security.py caches role_revision",
            "set_json(build_cache_key(\"role_revision\"" in content,
            "security.py missing role_revision cache call.",
        )
        check(
            "No circular import from backend.main",
            "from backend.main import" not in content,
            "security.py still imports from backend.main (circular import risk).",
        )

    if pdp_py.exists():
        content = pdp_py.read_text()
        check(
            "pdp.py imports logging",
            "import logging" in content,
            "pdp.py missing logging import.",
        )
        check(
            "pdp.py has role_revision freshness check",
            "role_revision" in content,
            "pdp.py missing role_revision freshness check.",
        )


# ── D-14: Audit Log Partitioning & Retention ─────────────────────────────────
def check_d14() -> None:
    print("\n[D-14] Audit Log Partitioning & Retention")
    migration = PROJECT_ROOT / "alembic" / "versions" / "20260707_02_audit_log_partitioning.py"
    archival_service = PROJECT_ROOT / "backend" / "services" / "audit_archival_service.py"

    check(
        "Migration file exists",
        migration.exists(),
        "Missing audit_log partitioning migration.",
    )
    check(
        "Archival service exists",
        archival_service.exists(),
        "Missing audit archival service.",
    )

    if migration.exists():
        content = migration.read_text()
        check(
            "Migration has RLS policy recreation",
            "rls_org_isolation" in content,
            "Migration missing RLS policy recreation (critical for multi-tenancy).",
        )

    if archival_service.exists():
        content = archival_service.read_text()
        check(
            "Archival service has PostgreSQL guard",
            "_is_postgresql" in content,
            "Archival service missing PostgreSQL dialect check.",
        )

    # Verify main.py wiring
    main_py = PROJECT_ROOT / "backend" / "main.py"
    if main_py.exists():
        content = main_py.read_text()
        check(
            "main.py imports audit archival service",
            "audit_archival_service" in content,
            "main.py missing audit archival service import.",
        )
        check(
            "main.py initializes archival service in lifespan",
            "initialize_audit_archival_service()" in content,
            "main.py missing archival service init call.",
        )
        check(
            "main.py shuts down archival service",
            "shutdown_audit_archival_service()" in content,
            "main.py missing archival service shutdown call.",
        )


# ── General Checks ───────────────────────────────────────────────────────────
def check_general() -> None:
    print("\n[GENERAL] Deployment Checks")
    
    # Check REDIS_URL is set (needed for D-18 and ARCH-03)
    if not os.getenv("REDIS_URL"):
        warn("REDIS_URL not set in environment", "Redis caching (D-18) and rq (ARCH-03) require REDIS_URL.")
    
    # Check render.yaml env vars
    render_yaml = PROJECT_ROOT / "render.yaml"
    if render_yaml.exists():
        content = render_yaml.read_text()
        if "REDIS_URL" not in content and "REDIS" not in content:
            warn(
                "REDIS_URL not found in render.yaml envVars",
                "Add REDIS_URL env var to render.yaml for Redis connectivity.",
            )
    
    # Check environment files
    env_file = PROJECT_ROOT / ".env"
    if env_file.exists():
        env_content = env_file.read_text()
        if "AUDIT_RETENTION_HOT_DAYS" in env_content:
            warn(
                "AUDIT_RETENTION_HOT_DAYS in .env",
                "Ensure retention settings are configured in production env (not .env).",
            )

    print()  # blank line


def main() -> None:
    print("=" * 60)
    print("  DEPLOYMENT PRE-FLIGHT CHECKLIST")
    print("=" * 60)

    check_d15()
    check_d18()
    check_d14()
    check_general()

    print("\n" + "=" * 60)
    print("  RESULTS")
    print("=" * 60)

    if FAILURES:
        print(f"\n  FAIL: {len(FAILURES)} failure(s):")
        for f in FAILURES:
            print(f"     * {f}")
    else:
        print("\n  PASS: All checks passed!")

    if WARNINGS:
        print(f"\n  WARN: {len(WARNINGS)} warning(s):")
        for w in WARNINGS:
            print(f"     * {w}")

    print()
    return 1 if FAILURES else 0


if __name__ == "__main__":
    sys.exit(main())
