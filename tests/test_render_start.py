from __future__ import annotations

from pathlib import Path

import pytest
from sqlalchemy import create_engine, text

import backend.database as database_module
from scripts.render_start import _inspect_alembic_state, _should_bootstrap_legacy_schema


def test_bootstrap_legacy_schema_when_app_tables_exist_without_alembic_history(tmp_path):
    database_path = tmp_path / "legacy.db"
    engine = create_engine(f"sqlite:///{database_path}", future=True)
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE users (id INTEGER PRIMARY KEY)"))
        connection.execute(text("CREATE TABLE factories (factory_id TEXT PRIMARY KEY)"))
    engine.dispose()

    table_names, has_version_row = _inspect_alembic_state(f"sqlite:///{database_path}")

    assert "users" in table_names
    assert "factories" in table_names
    assert has_version_row is False
    assert _should_bootstrap_legacy_schema(
        table_names=table_names,
        has_version_row=has_version_row,
    )


def test_skip_bootstrap_when_alembic_history_exists(tmp_path):
    database_path = tmp_path / "managed.db"
    engine = create_engine(f"sqlite:///{database_path}", future=True)
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE users (id INTEGER PRIMARY KEY)"))
        connection.execute(text("CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL)"))
        connection.execute(text("INSERT INTO alembic_version (version_num) VALUES ('20260327_01')"))
    engine.dispose()

    table_names, has_version_row = _inspect_alembic_state(f"sqlite:///{database_path}")

    assert "users" in table_names
    assert "alembic_version" in table_names
    assert has_version_row is True
    assert not _should_bootstrap_legacy_schema(
        table_names=table_names,
        has_version_row=has_version_row,
    )


def test_init_db_ensures_structured_ocr_columns_on_legacy_table(tmp_path, monkeypatch: pytest.MonkeyPatch):
    database_path = Path(tmp_path) / "legacy_ocr.db"
    legacy_engine = create_engine(f"sqlite:///{database_path}", future=True)
    with legacy_engine.begin() as connection:
        connection.execute(
            text(
                """
                CREATE TABLE ocr_verifications (
                    id INTEGER PRIMARY KEY,
                    org_id VARCHAR(36),
                    factory_id VARCHAR(36),
                    user_id INTEGER NOT NULL,
                    template_id INTEGER,
                    source_filename VARCHAR(255),
                    source_image_path TEXT,
                    columns INTEGER NOT NULL DEFAULT 3,
                    language VARCHAR(20) NOT NULL DEFAULT 'eng',
                    avg_confidence FLOAT,
                    warnings JSON,
                    headers JSON,
                    original_rows JSON,
                    reviewed_rows JSON,
                    raw_column_added BOOLEAN NOT NULL DEFAULT 0,
                    status VARCHAR(20) NOT NULL DEFAULT 'draft',
                    reviewer_notes TEXT,
                    rejection_reason TEXT,
                    submitted_at DATETIME,
                    approved_at DATETIME,
                    rejected_at DATETIME,
                    approved_by INTEGER,
                    rejected_by INTEGER,
                    created_at DATETIME,
                    updated_at DATETIME
                )
                """
            )
        )

    original_engine = database_module.engine
    try:
        monkeypatch.setattr(database_module, "engine", legacy_engine)
        database_module._ensure_ocr_verification_columns()
    finally:
        monkeypatch.setattr(database_module, "engine", original_engine)

    inspector = database_module.inspect(legacy_engine)
    columns = {column["name"] for column in inspector.get_columns("ocr_verifications")}
    legacy_engine.dispose()

    assert "scan_quality" in columns
    assert "document_hash" in columns
    assert "doc_type_hint" in columns
    assert "routing_meta" in columns
    assert "raw_text" in columns
