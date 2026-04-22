from __future__ import annotations

from sqlalchemy import create_engine, text

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
