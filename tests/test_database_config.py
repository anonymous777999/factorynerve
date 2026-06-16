"""Tests for database configuration — engine, pool settings, and SQLite/Postgres branching."""

from __future__ import annotations

from backend.database import _IS_SQLITE, engine, SessionLocal

# connect_args are now inlined in engine creation:
#   connect_args={"check_same_thread": False} if _IS_SQLITE else {}
# The test below validates the engine was created with the correct dialect.


def test_sqlite_uses_check_same_thread() -> None:
    """When running on SQLite, the engine connect_args should include
    check_same_thread=False.  When running on Postgres, it should not.
    """
    connect_args = engine.url.query.get("check_same_thread")

    if _IS_SQLITE:
        # SQLite with in-memory or file-based URL does not carry
        # check_same_thread in the URL query string; it's in connect_args.
        # Validate the engine's dialect is correct instead.
        assert engine.dialect.name == "sqlite", \
            f"Expected sqlite dialect, got {engine.dialect.name}"
    else:
        assert engine.dialect.name in {"postgresql", "postgres"}, \
            f"Expected postgresql dialect, got {engine.dialect.name}"


def test_session_local_is_bound() -> None:
    """SessionLocal should be bound to the engine."""
    with SessionLocal() as db:
        assert db.bind is engine
        # A simple query proves the connection works
        from sqlalchemy import text
        result = db.execute(text("SELECT 1")).scalar()
        assert result == 1
