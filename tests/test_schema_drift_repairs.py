from __future__ import annotations

import os
from pathlib import Path
import importlib.util

from alembic import command
from alembic.config import Config
import pytest
from sqlalchemy import create_engine, text

import backend.database as database_module


def _run_alembic_upgrade(database_url: str) -> None:
    config = Config("alembic.ini")
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = database_url
    try:
        command.upgrade(config, "head")
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


def test_startup_repair_adds_missing_phone_and_alert_columns(tmp_path, monkeypatch: pytest.MonkeyPatch):
    database_path = Path(tmp_path) / "legacy_alerting.db"
    legacy_engine = create_engine(f"sqlite:///{database_path}", future=True)
    with legacy_engine.begin() as connection:
        connection.execute(text("CREATE TABLE users (id INTEGER PRIMARY KEY, phone_number VARCHAR(32))"))
        connection.execute(text("CREATE TABLE admin_alert_recipients (id INTEGER PRIMARY KEY, phone_number VARCHAR(32))"))
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
                    id, phone_e164, otp_hash, expires_at, attempts, used, channel, purpose, user_id, recipient_id, created_at
                ) VALUES (
                    'legacy-otp-1', '+919876543299', 'hash', CURRENT_TIMESTAMP, 0, 0, 'sms', 'user_verification', NULL, NULL, CURRENT_TIMESTAMP
                )
                """
            )
        )
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

    original_engine = database_module.engine
    try:
        monkeypatch.setattr(database_module, "engine", legacy_engine)
        database_module._ensure_phone_and_alerting_columns()
    finally:
        monkeypatch.setattr(database_module, "engine", original_engine)

    inspector = database_module.inspect(legacy_engine)
    ops_columns = {column["name"] for column in inspector.get_columns("ops_alert_events")}
    phone_columns = {column["name"] for column in inspector.get_columns("phone_verifications")}
    ops_indexes = {index["name"] for index in inspector.get_indexes("ops_alert_events")}
    with legacy_engine.connect() as connection:
        channel = connection.execute(
            text("SELECT channel FROM phone_verifications WHERE id = 'legacy-otp-1'")
        ).scalar_one()
    legacy_engine.dispose()

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


def test_postgres_enum_repair_is_idempotent():
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

        def __init__(self, labels):
            self.dialect = self.Dialect()
            self.labels = labels
            self.executed: list[str] = []

        def execute(self, _statement, _params):
            return FakeResult(self.labels)

        def exec_driver_sql(self, sql: str):
            self.executed.append(sql)

    missing_value_conn = FakeConnection(["user_verification"])
    assert database_module._ensure_postgres_enum_value(
        missing_value_conn,
        enum_name="phone_verification_purpose",
        enum_value="alert_recipient",
    )
    assert missing_value_conn.executed == [
        "ALTER TYPE phone_verification_purpose ADD VALUE IF NOT EXISTS 'alert_recipient'"
    ]

    existing_value_conn = FakeConnection(["user_verification", "alert_recipient"])
    assert not database_module._ensure_postgres_enum_value(
        existing_value_conn,
        enum_name="phone_verification_purpose",
        enum_value="alert_recipient",
    )
    assert existing_value_conn.executed == []


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


def test_messaging_schema_verifier_fails_for_missing_critical_columns(tmp_path, monkeypatch: pytest.MonkeyPatch):
    database_path = Path(tmp_path) / "invalid_messaging_schema.db"
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
        connection.execute(
            text(
                """
                CREATE TABLE ops_alert_events (
                    id INTEGER PRIMARY KEY,
                    ref_id VARCHAR(80) NOT NULL,
                    org_id VARCHAR(36),
                    org_name VARCHAR(200),
                    status VARCHAR(24) NOT NULL DEFAULT 'queued',
                    event_type VARCHAR(64) NOT NULL,
                    severity VARCHAR(16) NOT NULL,
                    summary TEXT NOT NULL,
                    recipient_phone VARCHAR(48),
                    provider VARCHAR(32) NOT NULL,
                    delivery_status VARCHAR(32) NOT NULL DEFAULT 'queued',
                    provider_message_id VARCHAR(255),
                    provider_status_at DATETIME,
                    delivered_at DATETIME,
                    read_at DATETIME,
                    failed_at DATETIME,
                    provider_error_code VARCHAR(64),
                    provider_error_title VARCHAR(255),
                    created_at DATETIME NOT NULL,
                    dispatched_at DATETIME
                )
                """
            )
        )

    original_engine = database_module.engine
    try:
        monkeypatch.setattr(database_module, "engine", invalid_engine)
        with pytest.raises(RuntimeError) as error:
            database_module._verify_messaging_schema_or_raise()
    finally:
        monkeypatch.setattr(database_module, "engine", original_engine)
        invalid_engine.dispose()

    assert "phone_verifications.channel" in str(error.value)


def test_alembic_upgrade_head_repairs_drifted_ops_alert_schema(tmp_path):
    database_path = Path(tmp_path) / "drifted.db"
    database_url = f"sqlite:///{database_path}"
    engine = create_engine(database_url, future=True)
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL)"))
        connection.execute(text("INSERT INTO alembic_version (version_num) VALUES ('20260516_03')"))
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
    engine.dispose()

    _run_alembic_upgrade(database_url)

    inspector = database_module.inspect(create_engine(database_url, future=True))
    columns = {column["name"] for column in inspector.get_columns("ops_alert_events")}
    indexes = {index["name"] for index in inspector.get_indexes("ops_alert_events")}

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
        connection.execute(text("CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL)"))
        connection.execute(text("INSERT INTO alembic_version (version_num) VALUES ('20260517_01')"))
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
                    id, phone_e164, otp_hash, expires_at, attempts, used, channel, purpose, user_id, recipient_id, created_at
                ) VALUES (
                    'legacy-otp-2', '+919876543298', 'hash', CURRENT_TIMESTAMP, 0, 0, 'sms', 'user_verification', NULL, NULL, CURRENT_TIMESTAMP
                )
                """
            )
        )
    engine.dispose()

    _run_alembic_upgrade(database_url)

    upgraded_engine = create_engine(database_url, future=True)
    with upgraded_engine.connect() as connection:
        channel = connection.execute(
            text("SELECT channel FROM phone_verifications WHERE id = 'legacy-otp-2'")
        ).scalar_one()
    upgraded_engine.dispose()

    assert channel == "whatsapp"


def test_alembic_upgrade_head_is_clean_on_fresh_sqlite(tmp_path):
    database_path = Path(tmp_path) / "fresh.db"
    database_url = f"sqlite:///{database_path}"

    _run_alembic_upgrade(database_url)
    _run_alembic_upgrade(database_url)

    bootstrap_engine = create_engine(database_url, future=True)
    original_engine = database_module.engine
    try:
        database_module.engine = bootstrap_engine
        database_module.init_db()
    finally:
        database_module.engine = original_engine

    inspector = database_module.inspect(bootstrap_engine)
    table_names = set(inspector.get_table_names())
    bootstrap_engine.dispose()

    assert "alembic_version" in table_names
    assert "phone_verifications" in table_names
    assert "ops_alert_events" in table_names
