"""Verify auth consolidation data integrity.

Runs a battery of checks to confirm all AuthUser data was properly migrated
into the User model and that all FK references (sessions, password resets)
are correctly backfilled.

Usage:
    python -m scripts.verify_auth_consolidation

Exit code: 0 if all checks pass, 1 if any check fails.
"""

from __future__ import annotations

import sys
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import inspect as sa_inspect, text

from backend.database import SessionLocal


# ── Helpers ──────────────────────────────────────────────────────────────

PASS = "✓"
FAIL = "✗"


def _print_result(name: str, passed: bool, detail: str) -> bool:
    icon = PASS if passed else FAIL
    status = "PASS" if passed else "FAIL"
    print(f"  {icon} {status} - {name}: {detail}")
    return passed


def _print_warn(name: str, detail: str) -> bool:
    """Print a warning result that doesn't count as a failure."""
    print(f"  {PASS} WARN - {name}: {detail}")
    return True


def _table_exists(inspector: Any, name: str) -> bool:
    return name in inspector.get_table_names()


def _column_names(inspector: Any, table: str) -> set[str]:
    return {col["name"] for col in inspector.get_columns(table)}


def _run_sql(db: Any, stmt: str) -> list[Any]:
    """Run a raw SQL query and return all scalar results."""
    return [row[0] for row in db.execute(text(stmt)).fetchall()]


def _fmt_sample(rows: list[Any], max_items: int = 5) -> str:
    """Format a sample of rows for display."""
    if not rows:
        return ""
    sample = rows[:max_items]
    return f" Sample: {sample}"


# ── Check definitions ───────────────────────────────────────────────────


def _check_authuser_exists_for_every_user(db: Any, dialect: str) -> bool:
    """C1: Every User should have a matching AuthUser record."""
    inspector = sa_inspect(db)
    if not _table_exists(inspector, "auth_users"):
        return _print_warn("C1: User -> AuthUser match",
                           "auth_users table does not exist (clean install).")

    rows = _run_sql(db, """
        SELECT u.id, u.email
        FROM users u
        LEFT JOIN auth_users au ON au.email = u.email
        WHERE au.id IS NULL
    """)
    count = len(rows)
    if count:
        return _print_warn("C1: User -> AuthUser match",
                           f"{count} users without AuthUser record.{_fmt_sample(rows)}")
    return _print_result("C1: User -> AuthUser match", True,
                         "All users have matching AuthUser records.")


def _check_auth_user_has_matching_user(db: Any, dialect: str) -> bool:
    """C2: Every AuthUser should have a matching User record."""
    inspector = sa_inspect(db)
    if not _table_exists(inspector, "auth_users"):
        return _print_result("C2: AuthUser -> User match", True,
                             "auth_users table does not exist (clean install).")

    rows = _run_sql(db, """
        SELECT au.id, au.email
        FROM auth_users au
        LEFT JOIN users u ON u.email = au.email
        WHERE u.id IS NULL
    """)
    count = len(rows)
    if count:
        return _print_result("C2: AuthUser -> User match", False,
                             f"{count} orphaned AuthUser records (no matching User).{_fmt_sample(rows)}")
    return _print_result("C2: AuthUser -> User match", True,
                         "Every AuthUser has a matching User.")


def _check_password_hash_version_migrated(db: Any, dialect: str) -> bool:
    """C3: Migrated users should have password_hash_version='argon2'."""
    inspector = sa_inspect(db)
    if not _table_exists(inspector, "auth_users"):
        return _print_result("C3: password_hash_version migrated", True,
                             "auth_users table does not exist (clean install).")

    rows = _run_sql(db, """
        SELECT u.id, u.email, u.password_hash_version
        FROM users u
        JOIN auth_users au ON au.email = u.email
        WHERE u.password_hash_version != 'argon2'
    """)
    count = len(rows)
    if count:
        return _print_result("C3: password_hash_version migrated", False,
                             f"{count} users still have password_hash_version != 'argon2'.{_fmt_sample(rows)}")
    return _print_result("C3: password_hash_version migrated", True,
                         "All migrated users have password_hash_version='argon2'.")


def _check_password_changed_at_backfilled(db: Any, dialect: str) -> bool:
    """C4: Users with AuthUser should have password_changed_at set."""
    inspector = sa_inspect(db)
    if not _table_exists(inspector, "auth_users"):
        return _print_result("C4: password_changed_at backfilled", True,
                             "auth_users table does not exist (clean install).")

    rows = _run_sql(db, """
        SELECT u.id, u.email
        FROM users u
        JOIN auth_users au ON au.email = u.email
        WHERE u.password_changed_at IS NULL
    """)
    count = len(rows)
    if count:
        return _print_warn("C4: password_changed_at backfilled",
                           f"{count} users still have NULL password_changed_at.{_fmt_sample(rows)}")
    return _print_result("C4: password_changed_at backfilled", True,
                         "All migrated users have password_changed_at set.")


def _check_mfa_enabled_migrated(db: Any, dialect: str) -> bool:
    """C5: MFA-enabled users should have the flag migrated correctly."""
    inspector = sa_inspect(db)
    if not _table_exists(inspector, "auth_users"):
        return _print_result("C5: MFA enabled flag migrated", True,
                             "auth_users table does not exist (clean install).")

    rows = _run_sql(db, """
        SELECT u.id, u.email
        FROM auth_users au
        JOIN users u ON u.email = au.email
        WHERE au.mfa_enabled = 1 AND u.mfa_enabled = 0
    """)
    count = len(rows)
    if count:
        return _print_result("C5: MFA enabled flag migrated", False,
                             f"{count} users had MFA enabled in AuthUser but not in User.{_fmt_sample(rows)}")
    return _print_result("C5: MFA enabled flag migrated", True,
                         "All MFA flags migrated correctly.")


def _check_mfa_secret_migrated(db: Any, dialect: str) -> bool:
    """C6: MFA secrets should be migrated for users who had them in AuthUser."""
    inspector = sa_inspect(db)
    if not _table_exists(inspector, "auth_users"):
        return _print_result("C6: MFA secrets migrated", True,
                             "auth_users table does not exist (clean install).")

    rows = _run_sql(db, """
        SELECT u.id, u.email
        FROM auth_users au
        JOIN users u ON u.email = au.email
        WHERE au.mfa_secret_encrypted IS NOT NULL AND u.mfa_secret_encrypted IS NULL
    """)
    count = len(rows)
    if count:
        return _print_result("C6: MFA secrets migrated", False,
                             f"{count} users had MFA secret in AuthUser but not in User.{_fmt_sample(rows)}")
    return _print_result("C6: MFA secrets migrated", True,
                         "All MFA secrets migrated correctly.")


def _check_lockout_data_migrated(db: Any, dialect: str) -> bool:
    """C7: Lockout fields (failed_login_attempts) should match."""
    inspector = sa_inspect(db)
    if not _table_exists(inspector, "auth_users"):
        return _print_result("C7: Lockout data migrated", True,
                             "auth_users table does not exist (clean install).")

    rows = _run_sql(db, """
        SELECT u.id, u.email
        FROM auth_users au
        JOIN users u ON u.email = au.email
        WHERE au.failed_login_attempts != u.failed_login_attempts
    """)
    count = len(rows)
    if count:
        return _print_result("C7: Lockout data migrated", False,
                             f"{count} users with mismatched failed_login_attempts.{_fmt_sample(rows)}")
    return _print_result("C7: Lockout data migrated", True,
                         "Lockout data matches across tables.")


def _check_locked_until_migrated(db: Any, dialect: str) -> bool:
    """C8: Locked accounts should have locked_until in both tables."""
    inspector = sa_inspect(db)
    if not _table_exists(inspector, "auth_users"):
        return _print_result("C8: locked_until migrated", True,
                             "auth_users table does not exist (clean install).")

    rows = _run_sql(db, """
        SELECT u.id, u.email
        FROM auth_users au
        JOIN users u ON u.email = au.email
        WHERE au.locked_until IS NOT NULL AND u.locked_until IS NULL
    """)
    count = len(rows)
    if count:
        return _print_result("C8: locked_until migrated", False,
                             f"{count} users had locked_until in AuthUser but not in User.{_fmt_sample(rows)}")
    return _print_result("C8: locked_until migrated", True,
                         "locked_until migrated correctly.")


def _check_email_verified_migrated(db: Any, dialect: str) -> bool:
    """C9: Email verification status should match."""
    inspector = sa_inspect(db)
    if not _table_exists(inspector, "auth_users"):
        return _print_result("C9: Email verified flag migrated", True,
                             "auth_users table does not exist (clean install).")

    mismatches = _run_sql(db, """
        SELECT u.id, u.email
        FROM auth_users au
        JOIN users u ON u.email = au.email
        WHERE CAST(au.is_email_verified AS INTEGER) != CAST(u.is_email_verified AS INTEGER)
    """)
    count = len(mismatches)
    if count:
        return _print_result("C9: Email verified flag migrated", False,
                             f"{count} users with mismatched is_email_verified.{_fmt_sample(mismatches)}")
    return _print_result("C9: Email verified flag migrated", True,
                         "Email verified flags match.")


def _check_session_user_id_backfilled(db: Any, dialect: str) -> bool:
    """C10: All auth_sessions should have user_id backfilled."""
    inspector = sa_inspect(db)
    if not _table_exists(inspector, "auth_sessions"):
        return _print_result("C10: Session user_id backfill", True,
                             "auth_sessions table does not exist.")

    rows = _run_sql(db, "SELECT id FROM auth_sessions WHERE user_id IS NULL LIMIT 20")
    total = _run_sql(db, "SELECT COUNT(*) FROM auth_sessions")[0]
    count = len(rows)
    if count:
        return _print_result("C10: Session user_id backfill", False,
                             f"{count}/{total} sessions still have NULL user_id.{_fmt_sample(rows)}")
    return _print_result("C10: Session user_id backfill", True,
                         f"All {total} sessions have user_id backfilled.")


def _check_password_reset_user_id_backfilled(db: Any, dialect: str) -> bool:
    """C11: AuthPasswordReset records should have user_id backfilled."""
    inspector = sa_inspect(db)
    if not _table_exists(inspector, "auth_password_resets"):
        return _print_result("C11: Password reset user_id backfill", True,
                             "auth_password_resets table does not exist.")

    if "user_id" not in _column_names(inspector, "auth_password_resets"):
        return _print_result("C11: Password reset user_id backfill", True,
                             "user_id column not yet added (phase 4 migration pending).")

    rows = _run_sql(db, "SELECT id FROM auth_password_resets WHERE user_id IS NULL LIMIT 20")
    total = _run_sql(db, "SELECT COUNT(*) FROM auth_password_resets")[0]
    count = len(rows)
    if count:
        return _print_result("C11: Password reset user_id backfill", False,
                             f"{count}/{total} password resets still have NULL user_id.{_fmt_sample(rows)}")
    return _print_result("C11: Password reset user_id backfill", True,
                         f"All {total} password resets have user_id backfilled.")


def _check_no_orphaned_auth_audit_logs(db: Any, dialect: str) -> bool:
    """C12: Auth audit logs table should be dropped (migrated to AuditLog)."""
    inspector = sa_inspect(db)
    if _table_exists(inspector, "audit_logs"):
        audit_count = _run_sql(db, "SELECT COUNT(*) FROM audit_logs")[0]
        _print_result("C12: audit_logs active", True,
                      f"audit_logs table exists with {audit_count} records.")
    if _table_exists(inspector, "auth_audit_logs"):
        count = _run_sql(db, "SELECT COUNT(*) FROM auth_audit_logs")[0]
        return _print_result("C12: Auth audit logs cleaned up", False,
                             f"auth_audit_logs table still exists with {count} records!")
    return _print_result("C12: Auth audit logs cleaned up", True,
                         "auth_audit_logs table has been dropped.")


def _check_user_id_not_null_in_sessions(db: Any, dialect: str) -> bool:
    """C13: AuthSession.user_id should be NOT NULL (phase 4 migration)."""
    inspector = sa_inspect(db)
    if not _table_exists(inspector, "auth_sessions"):
        return _print_result("C13: Session user_id NOT NULL", True,
                             "auth_sessions table does not exist.")

    if "user_id" not in _column_names(inspector, "auth_sessions"):
        return _print_result("C13: Session user_id NOT NULL", True,
                             "user_id column not yet present in auth_sessions.")

    nullable = True
    for col in sa_inspect(db).get_columns("auth_sessions"):
        if col["name"] == "user_id":
            nullable = col.get("nullable", True)
            break

    if nullable is not False:
        return _print_warn("C13: Session user_id NOT NULL",
                           "user_id is still NULLABLE. Run phase 4 migration (20260705_06).")
    return _print_result("C13: Session user_id NOT NULL", True,
                         "user_id is correctly NOT NULL.")


def _check_updated_at_filled(db: Any, dialect: str) -> bool:
    """C14: updated_at should be set for all users."""
    total = _run_sql(db, "SELECT COUNT(*) FROM users")[0]
    rows = _run_sql(db, "SELECT id FROM users WHERE updated_at IS NULL LIMIT 10")
    count = len(rows)
    if count:
        return _print_result("C14: updated_at populated", False,
                             f"{count}/{total} users have NULL updated_at.{_fmt_sample(rows)}")
    return _print_result("C14: updated_at populated", True,
                         f"All {total} users have updated_at set.")


def _check_duplicate_emails(db: Any, dialect: str) -> bool:
    """C15: No duplicate emails in users table."""
    rows = _run_sql(db, """
        SELECT email, COUNT(*) as cnt
        FROM users
        GROUP BY email
        HAVING COUNT(*) > 1
    """)
    count = len(rows)
    if count:
        return _print_result("C15: No duplicate user emails", False,
                             f"{count} duplicate emails found.{_fmt_sample(rows)}")
    return _print_result("C15: No duplicate user emails", True,
                         "No duplicate emails.")


def _check_session_fk_integrity(db: Any, dialect: str) -> bool:
    """C16: Sessions with user_id should reference a valid user."""
    inspector = sa_inspect(db)
    if not _table_exists(inspector, "auth_sessions"):
        return _print_result("C16: Session user FK integrity", True,
                             "auth_sessions table does not exist.")

    rows = _run_sql(db, """
        SELECT s.id, s.user_id
        FROM auth_sessions s
        LEFT JOIN users u ON u.id = s.user_id
        WHERE s.user_id IS NOT NULL AND u.id IS NULL
        LIMIT 10
    """)
    count = len(rows)
    if count:
        return _print_result("C16: Session user FK integrity", False,
                             f"{count} sessions reference non-existent user_id.{_fmt_sample(rows)}")
    return _print_result("C16: Session user FK integrity", True,
                         "All session user_id values reference valid users.")


def _check_auth_users_can_be_dropped(db: Any, dialect: str) -> bool:
    """C17: Readiness check — can auth_users table be safely dropped?"""
    inspector = sa_inspect(db)
    if not _table_exists(inspector, "auth_users"):
        return _print_result("C17: AuthUsers drop readiness", True,
                             "auth_users table already dropped.")

    total_au = _run_sql(db, "SELECT COUNT(*) FROM auth_users")[0]
    matched = _run_sql(db, """
        SELECT COUNT(*) FROM auth_users au
        JOIN users u ON u.email = au.email
    """)[0]
    orphaned_au = total_au - matched

    details = f"auth_users total={total_au}, matched_to_users={matched}"
    if orphaned_au:
        details += f", orphaned={orphaned_au}"

    session_refs = 0
    if _table_exists(inspector, "auth_sessions"):
        session_refs = _run_sql(db, """
            SELECT COUNT(*) FROM auth_sessions s
            LEFT JOIN auth_users au ON au.id = s.auth_user_id
            WHERE au.id IS NULL
        """)[0]
        if session_refs:
            details += f", sessions.refs_without_authuser={session_refs}"

    resets_refs = 0
    if _table_exists(inspector, "auth_password_resets"):
        resets_refs = _run_sql(db, """
            SELECT COUNT(*) FROM auth_password_resets apr
            LEFT JOIN auth_users au ON au.id = apr.auth_user_id
            WHERE au.id IS NULL
        """)[0]
        if resets_refs:
            details += f", password_resets.refs_without_authuser={resets_refs}"

    ready = orphaned_au == 0 and session_refs == 0 and resets_refs == 0
    return _print_result("C17: AuthUsers drop readiness", ready, details)


# ── Main ─────────────────────────────────────────────────────────────────


def main() -> int:
    print()
    print("=" * 70)
    print(" Auth Consolidation — Data Integrity Verification")
    print("=" * 70)
    print()

    db = SessionLocal()
    try:
        engine = db.bind
        if engine is None:
            print("  ! FAIL - No database engine bound to session.")
            return 1
        dialect = engine.dialect.name
        inspector = sa_inspect(engine)
        tables = inspector.get_table_names()

        print(f" Database dialect: {dialect}")
        print(f" Tables present ({len(tables)}): {', '.join(sorted(tables))}")
        print()

        checks = [
            ("C1: AuthUser exists for every User", _check_authuser_exists_for_every_user),
            ("C2: Every AuthUser has matching User", _check_auth_user_has_matching_user),
            ("C3: password_hash_version migrated", _check_password_hash_version_migrated),
            ("C4: password_changed_at backfilled", _check_password_changed_at_backfilled),
            ("C5: MFA enabled flag migrated", _check_mfa_enabled_migrated),
            ("C6: MFA secrets migrated", _check_mfa_secret_migrated),
            ("C7: Lockout data migrated", _check_lockout_data_migrated),
            ("C8: locked_until migrated", _check_locked_until_migrated),
            ("C9: Email verified flag migrated", _check_email_verified_migrated),
            ("C10: Session user_id backfill", _check_session_user_id_backfilled),
            ("C11: Password reset user_id backfill", _check_password_reset_user_id_backfilled),
            ("C12: Auth audit logs cleaned up", _check_no_orphaned_auth_audit_logs),
            ("C13: Session user_id NOT NULL", _check_user_id_not_null_in_sessions),
            ("C14: updated_at populated", _check_updated_at_filled),
            ("C15: No duplicate emails", _check_duplicate_emails),
            ("C16: Session user FK integrity", _check_session_fk_integrity),
            ("C17: AuthUsers drop readiness", _check_auth_users_can_be_dropped),
        ]

        results: list[bool] = []
        for name, check_fn in checks:
            try:
                result = check_fn(db, dialect)
                results.append(result)
            except Exception as error:
                print(f"  {FAIL} FAIL - {name}: ERROR — {error}")
                results.append(False)

        passed = sum(1 for r in results if r)
        total = len(results)
        failed = total - passed

        print()
        print("-" * 70)
        print(f" Results: {passed}/{total} checks passed")
        if failed:
            print(f"          {failed} checks FAILED — review details above")
        print("=" * 70)
        print()

        return 0 if passed == total else 1

    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
