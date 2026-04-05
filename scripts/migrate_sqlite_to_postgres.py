"""Copy data from SQLite to PostgreSQL using SQLAlchemy metadata."""

from __future__ import annotations

import os
from pathlib import Path

import sys
from dotenv import load_dotenv
from sqlalchemy import create_engine

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.database import Base
from backend.utils import PROJECT_ROOT


def _default_sqlite_url() -> str:
    return f"sqlite:///{(PROJECT_ROOT / 'dpr_ai.db').as_posix()}"


def main() -> None:
    load_dotenv(PROJECT_ROOT / ".env")
    source_url = os.getenv("SQLITE_SOURCE_URL") or _default_sqlite_url()
    target_url = os.getenv("DATABASE_URL") or ""
    if not target_url or not target_url.startswith("postgresql"):
        raise RuntimeError("DATABASE_URL must point to PostgreSQL for migration.")
    if not source_url.startswith("sqlite:///"):
        raise RuntimeError("SQLITE_SOURCE_URL must point to SQLite for migration.")

    src_engine = create_engine(source_url)
    dst_engine = create_engine(target_url)

    Base.metadata.create_all(dst_engine)

    with src_engine.connect() as src_conn, dst_engine.begin() as dst_conn:
        for table in Base.metadata.sorted_tables:
            rows = list(src_conn.execute(table.select()).mappings())
            if rows:
                dst_conn.execute(table.insert(), rows)

    print("SQLite → PostgreSQL migration complete.")


if __name__ == "__main__":
    main()
