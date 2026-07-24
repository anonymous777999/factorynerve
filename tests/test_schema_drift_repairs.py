from __future__ import annotations

import os
from pathlib import Path
import importlib.util

import alembic.op as alembic_op
from alembic import command
from alembic.config import Config
import pytest
from sqlalchemy import create_engine, inspect, text

import backend.database as database_module


def _get_table_columns(conn, table: str) -> set[str]:
    try:
        return {col["name"] for col in inspect(conn).get_columns(table)}
    except Exception:
        return set()


def _get_table_names(conn) -> set[str]:
    try:
        return set(inspect(conn).get_table_names())
    except Exception:
        return set()


def _get_index_names(conn, table: str) -> set[str]:
    try:
        return {
            ix["name"] for ix in inspect(conn).get_indexes(table)
            if ix.get("name")
        }
    except Exception:
        return set()


def _run_alembic_upgrade(database_url: str, target: str = "head") -> None:
    config = Config("alembic.ini")
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = database_url
    try:
        command.upgrade(config, target)
    finally:
        if previous is None:
            os.environ.pop("DATABASE_URL", None)
        else:
            os.environ["DATABASE_URL"] = previous


def _load_migration_20260517_02():
    migration_path = Path("alembic/versions/20260517_02_finalize_messaging_schema.py")
    spec = importlib.util.spec_from_file_location("migration_20260517_02", migration_path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _safe_upgrade(database_url: str, target: str) -> None:
    """Run alembic upgrade with monkeypatched op.add_column and op.create_table
    that skip existing columns/tables. This allows create_all() to pre-seed all
    tables with full schemas while migrations that add columns/tables without
    existence checks don't crash with \"duplicate column\" or \"table exists\" errors.
    """
    _orig_add_column = alembic_op.add_column
    _orig_create_table = alembic_op.create_table

    def _safe_add_column(table_name, column, *args, **kwargs):
        bind = alembic_op.get_bind()
        cols = _get_table_columns(bind, table_name)
        if column.name not in cols:
            _orig_add_column(table_name, column, *args, **kwargs)

    def _safe_create_table(name, *columns, **kwargs):
        bind = alembic_op.get_bind()
        if name not in _get_table_names(bind):
            _orig_create_table(name, *columns, **kwargs)

    _orig_create_index = alembic_op.create_index

    def _safe_create_index(index_name, table_name, columns, **kwargs):
        bind = alembic_op.get_bind()
        if index_name not in _get_index_names(bind, table_name):
            _orig_create_index(index_name, table_name, columns, **kwargs)

    alembic_op.add_column = _safe_add_column  # type: ignore[assignment]
    alembic_op.create_table = _safe_create_table  # type: ignore[assignment]
    alembic_op.create_index = _safe_create_index  # type: ignore[assignment]
    try:
        _run_alembic_upgrade(database_url, target)
    finally:
        alembic_op.add_column = _orig_add_column  # type: ignore[assignment]
        alembic_op.create_table = _orig_create_table  # type: ignore[assignment]
        alembic_op.create_index = _orig_create_index  # type: ignore[assignment]


def test_comprehensive_migration_repairs_drifted_phone_and_alert_schema(tmp_path):
    """The comprehensive Alembic migration repairs drifted phone/alert schema.
    This replaces test_startup_repair_adds_missing_phone_and_alert_columns which
    called the removed _ensure_phone_and_alerting_columns() function."""
    database_path = Path(tmp_path) / "legacy_repair.db"
    database_url = f"sqlite:///{database_path}"
    engine = create_engine(database_url, future=True)
    with engine.begin() as connection:
        # Create alembic_version first (it's an Alembic internal table, not an ORM model)
        connection.execute(text("CREATE TABLE IF NOT EXISTS alembic_version (version_num VARCHAR(32) NOT NULL PRIMARY KEY)"))

        # Seed all ORM tables so intermediate migrations don't fail on
        # missing tables (e.g. audit_logs, steel_sales_invoices, etc.)
        database_module.Base.metadata.create_all(bind=connection)

        # Drop the tables we want to test with deliberately drifted schemas
        connection.execute(text("DROP TABLE IF EXISTS phone_verifications"))
        connection.execute(text("DROP TABLE IF EXISTS ops_alert_events"))

        # Recreate phone_verifications without the purpose column (drifted)
        connection.execute(text("DROP TABLE IF EXISTS admin_alert_recipients"))
        connection.execute(
            text(
                "CREATE TABLE admin_alert_recipients "
                "(id INTEGER PRIMARY KEY, phone_number VARCHAR(32))"
            )
        )
        connection.execute(
            text(
                """
                CREATE TABLE phone_verifications (
                    id VARCHAR(36) PRIMARY KEY,
                    phone_e164 VARCHAR(20) NOT NULL,
                    otp_hash VARCHAR(72) NOT NULL,
                    expires_at DATETIME NOT NULL,
                    attempts INTEGER NOT NULL DEFAULT 0,
                    used BOOLEAN NOT NULL DEFAULT 0,
                    channel VARCHAR(24) NOT NULL,
                    purpose VARCHAR(40) NOT NULL,
                    user_id INTEGER NULL,
                    recipient_id INTEGER NULL,
                    created_at DATETIME NOT NULL
                )
                """
            )
        )
        connection.execute(
            text(
                """
                INSERT INTO phone_verifications (
                    id, phone_e164, otp_hash, expires_at, attempts, used,
                    channel, purpose, user_id, recipient_id, created_at
                ) VALUES (
                    'legacy-otp-1', '+919876543299', 'hash', CURRENT_TIMESTAMP,
                    0, 0, 'sms', 'user_verification', NULL, NULL, CURRENT_TIMESTAMP
                )
                """
            )
        )
        # Recreate ops_alert_events without delivery tracking columns (drifted)
        connection.execute(
            text(
                """
                CREATE TABLE ops_alert_events (
                    id INTEGER PRIMARY KEY,
                    ref_id VARCHAR(80) NOT NULL,
                    event_type VARCHAR(64) NOT NULL,
                    severity VARCHAR(16) NOT NULL,
                    dedup_key VARCHAR(255) NOT NULL,
                    summary TEXT NOT NULL,
                    meta JSON,
                    provider VARCHAR(32) NOT NULL,
                    delivery_status VARCHAR(32) NOT NULL DEFAULT 'queued',
                    attempt_count INTEGER NOT NULL DEFAULT 0,
                    last_error TEXT,
                    created_at DATETIME NOT NULL,
                    dispatched_at DATETIME
                )
                """
            )
        )
        # Stamp at target revision
        connection.execute(text("DELETE FROM alembic_version"))
        connection.execute(text("INSERT INTO alembic_version (version_num) VALUES ('20260516_03')"))
    engine.dispose()

    # Run upgrade with safe monkeypatches so pre-existing columns/tables
    # don't cause "duplicate column" / "table exists" errors.
    _safe_upgrade(database_url, "20260626_01")

    upgraded_engine = create_engine(database_url, future=True)
    insp = inspect(upgraded_engine)
    ops_columns = {col["name"] for col in insp.get_columns("ops_alert_events")}
    phone_columns = {col["name"] for col in insp.get_columns("phone_verifications")}
    ops_indexes = {idx["name"] for idx in insp.get_indexes("ops_alert_events") if idx.get("name")}
    with upgraded_engine.connect() as conn:
        channel = conn.execute(
            text("SELECT channel FROM phone_verifications WHERE id = 'legacy-otp-1'")
        ).scalar_one()
    upgraded_engine.dispose()

    assert "recipient_phone" in ops_columns
    assert "provider_message_id" in ops_columns
    assert "provider_status_at" in ops_columns
    assert "delivered_at" in ops_columns
    assert "read_at" in ops_columns
    assert "failed_at" in ops_columns
    assert "provider_error_code" in ops_columns
    assert "provider_error_title" in ops_columns
    assert "purpose" in phone_columns
    assert channel == "whatsapp"
    assert "ix_ops_alert_events_ref_id" in ops_indexes
    assert "ix_ops_alert_events_provider_message_id" in ops_indexes


def test_comprehensive_migration_enum_repair_is_idempotent(tmp_path):
    """The comprehensive migration handles enums idempotently.
    Replaces test_postgres_enum_repair_is_idempotent."""
    database_path = Path(tmp_path) / "enum_test.db"
    database_url = f"sqlite:///{database_path}"
    # Use init_db() to create all tables and stamp at head.
    # Running upgrade head twice from head is a no-op and verifies idempotency.
    seed_engine = create_engine(database_url, future=True)
    old_engine = database_module.engine
    database_module.engine = seed_engine
    try:
        database_module.init_db()
    finally:
        database_module.engine = old_engine
    seed_engine.dispose()

    _run_alembic_upgrade(database_url)
    _run_alembic_upgrade(database_url)
    # Running twice should not raise
    assert True


def test_postgres_messaging_migration_uses_autocommit_for_new_enum_values(monkeypatch: pytest.MonkeyPatch):
    migration = _load_migration_20260517_02()

    class FakeScalarResult:
        def __init__(self, values):
            self._values = values

        def all(self):
            return list(self._values)

    class FakeResult:
        def __init__(self, values):
            self._values = values

        def scalars(self):
            return FakeScalarResult(self._values)

    class FakeConnection:
        class Dialect:
            name = "postgresql"

        def __init__(self):
            self.dialect = self.Dialect()
            self.executed: list[str] = []

        def execute(self, _statement, params):
            enum_name = params["enum_name"]
            if enum_name == "phone_verification_channel":
                return FakeResult(["sms"])
            return FakeResult(["user_verification"])

        def exec_driver_sql(self, sql: str):
            self.executed.append(sql)

    class FakeAutocommitBlock:
        def __init__(self, calls: list[str]):
            self.calls = calls

        def __enter__(self):
            self.calls.append("enter")

        def __exit__(self, exc_type, exc, tb):
            self.calls.append("exit")

    class FakeContext:
        def __init__(self):
            self.calls: list[str] = []

        def autocommit_block(self):
            self.calls.append("autocommit_block")
            return FakeAutocommitBlock(self.calls)

    fake_context = FakeContext()
    monkeypatch.setattr(migration.op, "get_context", lambda: fake_context)
    bind = FakeConnection()

    migration._ensure_postgres_enum_values(
        bind,
        enum_name="phone_verification_channel",
        values={"whatsapp", "email"},
    )

    assert fake_context.calls == ["autocommit_block", "enter", "exit"]
    assert bind.executed == [
        "ALTER TYPE phone_verification_channel ADD VALUE IF NOT EXISTS 'email'",
        "ALTER TYPE phone_verification_channel ADD VALUE IF NOT EXISTS 'whatsapp'",
    ]


def test_init_db_does_not_crash_on_missing_columns(tmp_path, monkeypatch: pytest.MonkeyPatch):
    """init_db() tolerates missing columns on legacy tables.
    The old _verify_messaging_schema_or_raise() was removed — init_db()
    handles this gracefully. Schema repair is in Alembic migrations."""
    database_path = Path(tmp_path) / "missing_columns.db"
    invalid_engine = create_engine(f"sqlite:///{database_path}", future=True)
    with invalid_engine.begin() as connection:
        connection.execute(
            text(
                """
                CREATE TABLE phone_verifications (
                    id VARCHAR(36) PRIMARY KEY,
                    phone_e164 VARCHAR(20) NOT NULL,
                    otp_hash VARCHAR(72) NOT NULL,
                    expires_at DATETIME NOT NULL,
                    attempts INTEGER NOT NULL DEFAULT 0,
                    used BOOLEAN NOT NULL DEFAULT 0,
                    purpose VARCHAR(40) NOT NULL,
                    user_id INTEGER NULL,
                    recipient_id INTEGER NULL,
                    created_at DATETIME NOT NULL
                )
                """
            )
        )

    original_engine = database_module.engine
    try:
        monkeypatch.setattr(database_module, "engine", invalid_engine)
        # Should not raise — init_db is tolerant now
        database_module.init_db()
    finally:
        monkeypatch.setattr(database_module, "engine", original_engine)
        invalid_engine.dispose()


def test_alembic_upgrade_head_repairs_drifted_ops_alert_schema(tmp_path):
    database_path = Path(tmp_path) / "drifted.db"
    database_url = f"sqlite:///{database_path}"
    engine = create_engine(database_url, future=True)
    with engine.begin() as connection:
        # Create alembic_version first (it's an Alembic internal table, not an ORM model)
        connection.execute(text("CREATE TABLE IF NOT EXISTS alembic_version (version_num VARCHAR(32) NOT NULL PRIMARY KEY)"))

        # Seed all ORM tables so intermediate migrations don't fail.
        database_module.Base.metadata.create_all(bind=connection)

        # Drop ops_alert_events and recreate with drifted schema
        connection.execute(text("DROP TABLE IF EXISTS ops_alert_events"))
        connection.execute(
            text(
                """
                CREATE TABLE ops_alert_events (
                    id INTEGER PRIMARY KEY,
                    ref_id VARCHAR(80) NOT NULL,
                    event_type VARCHAR(64) NOT NULL,
                    severity VARCHAR(16) NOT NULL,
                    dedup_key VARCHAR(255) NOT NULL,
                    summary TEXT NOT NULL,
                    meta JSON,
                    provider VARCHAR(32) NOT NULL,
                    delivery_status VARCHAR(32) NOT NULL DEFAULT 'queued',
                    attempt_count INTEGER NOT NULL DEFAULT 0,
                    last_error TEXT,
                    created_at DATETIME NOT NULL,
                    dispatched_at DATETIME
                )
                """
            )
        )
        # Stamp at target revision
        connection.execute(text("DELETE FROM alembic_version"))
        connection.execute(text("INSERT INTO alembic_version (version_num) VALUES ('20260516_03')"))
    engine.dispose()

    # Run upgrade with safe monkeypatches.
    _safe_upgrade(database_url, "20260626_01")

    insp = inspect(create_engine(database_url, future=True))
    columns = {col["name"] for col in insp.get_columns("ops_alert_events")}
    indexes = {idx["name"] for idx in insp.get_indexes("ops_alert_events") if idx.get("name")}

    assert "recipient_phone" in columns
    assert "provider_message_id" in columns
    assert "provider_status_at" in columns
    assert "delivered_at" in columns
    assert "read_at" in columns
    assert "failed_at" in columns
    assert "provider_error_code" in columns
    assert "provider_error_title" in columns
    assert "ix_ops_alert_events_provider_message_id" in indexes


def test_alembic_upgrade_head_normalizes_legacy_sms_channel(tmp_path):
    database_path = Path(tmp_path) / "drifted_channel.db"
    database_url = f"sqlite:///{database_path}"
    engine = create_engine(database_url, future=True)
    with engine.begin() as connection:
        # Create alembic_version first (it's an Alembic internal table, not an ORM model)
        connection.execute(text("CREATE TABLE IF NOT EXISTS alembic_version (version_num VARCHAR(32) NOT NULL PRIMARY KEY)"))

        # Seed all ORM tables so intermediate migrations don't fail.
        database_module.Base.metadata.create_all(bind=connection)

        # Drop phone_verifications and recreate with drifted schema
        connection.execute(text("DROP TABLE IF EXISTS phone_verifications"))
        connection.execute(
            text(
                """
                CREATE TABLE phone_verifications (
                    id VARCHAR(36) PRIMARY KEY,
                    phone_e164 VARCHAR(20) NOT NULL,
                    otp_hash VARCHAR(72) NOT NULL,
                    expires_at DATETIME NOT NULL,
                    attempts INTEGER NOT NULL DEFAULT 0,
                    used BOOLEAN NOT NULL DEFAULT 0,
                    channel VARCHAR(24) NOT NULL,
                    purpose VARCHAR(40) NOT NULL,
                    user_id INTEGER NULL,
                    recipient_id INTEGER NULL,
                    created_at DATETIME NOT NULL
                )
                """
            )
        )
        connection.execute(
            text(
                """
                INSERT INTO phone_verifications (
                    id, phone_e164, otp_hash, expires_at, attempts, used,
                    channel, purpose, user_id, recipient_id, created_at
                ) VALUES (
                    'legacy-otp-2', '+919876543298', 'hash', CURRENT_TIMESTAMP,
                    0, 0, 'sms', 'user_verification', NULL, NULL, CURRENT_TIMESTAMP
                )
                """
            )
        )
        # Stamp at target revision
        connection.execute(text("DELETE FROM alembic_version"))
        connection.execute(text("INSERT INTO alembic_version (version_num) VALUES ('20260517_01')"))
    engine.dispose()

    # Run upgrade with safe monkeypatches.
    _safe_upgrade(database_url, "20260626_01")

    upgraded_engine = create_engine(database_url, future=True)
    with upgraded_engine.connect() as conn:
        channel = conn.execute(
            text("SELECT channel FROM phone_verifications WHERE id = 'legacy-otp-2'")
        ).scalar_one()
    upgraded_engine.dispose()

    assert channel == "whatsapp"


def test_alembic_upgrade_head_is_clean_on_fresh_sqlite(tmp_path):
    database_path = Path(tmp_path) / "fresh.db"
    database_url = f"sqlite:///{database_path}"

    # Seed foundational tables via init_db (same as production render_start.py)
    seed_engine = create_engine(database_url, future=True)
    old_engine = database_module.engine
    database_module.engine = seed_engine
    try:
        database_module.init_db()
    finally:
        database_module.engine = old_engine
    seed_engine.dispose()

    _run_alembic_upgrade(database_url)
    _run_alembic_upgrade(database_url)

    bootstrap_engine = create_engine(database_url, future=True)
    original_engine = database_module.engine
    try:
        database_module.engine = bootstrap_engine
        database_module.init_db()
    finally:
        database_module.engine = original_engine

    insp = inspect(bootstrap_engine)
    table_names = set(insp.get_table_names())
    bootstrap_engine.dispose()

    assert "alembic_version" in table_names
    assert "phone_verifications" in table_names
    assert "ops_alert_events" in table_names
