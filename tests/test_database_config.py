from __future__ import annotations

from backend.database import _build_connect_args


def test_postgres_connect_args_do_not_include_sqlite_only_options():
    args = _build_connect_args(is_sqlite=False)

    assert args == {"options": "-c statement_timeout=30000"}
    assert "check_same_thread" not in args


def test_sqlite_connect_args_include_thread_override():
    assert _build_connect_args(is_sqlite=True) == {"check_same_thread": False}
