"""Render container startup for FactoryNerve backend."""

from __future__ import annotations

import os
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from sqlalchemy import create_engine, text


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

env = os.environ.copy()
existing_pythonpath = env.get("PYTHONPATH", "").strip()
paths = [str(PROJECT_ROOT)]
if existing_pythonpath:
    paths.append(existing_pythonpath)
env["PYTHONPATH"] = os.pathsep.join(paths)

port = env.get("PORT", "10000")
run_migrations = env.get("RUN_ALEMBIC_ON_STARTUP", "true").strip().lower() in {"1", "true", "yes", "on"}
allow_init_db_fallback = env.get("ALLOW_INIT_DB_FALLBACK", "true").strip().lower() in {"1", "true", "yes", "on"}


def _normalize_database_url(url: str) -> str:
    normalized = url.strip()
    if normalized.startswith("postgres://"):
        normalized = "postgresql://" + normalized[len("postgres://") :]

    if normalized.startswith("postgresql://") and not normalized.startswith("postgresql+psycopg2://"):
        normalized = "postgresql+psycopg2://" + normalized[len("postgresql://") :]

    if "render.com" in normalized and "sslmode=" not in normalized:
        parts = urlsplit(normalized)
        query = dict(parse_qsl(parts.query, keep_blank_values=True))
        query["sslmode"] = "require"
        normalized = urlunsplit(
            (parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment)
        )

    return normalized


def _wait_for_database(url: str, *, attempts: int = 20, delay_seconds: int = 3) -> str:
    normalized = _normalize_database_url(url)
    engine = create_engine(normalized, future=True, pool_pre_ping=True)
    last_error: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            with engine.connect() as connection:
                connection.execute(text("SELECT 1"))
            print(f"[render-start] Database connection ready on attempt {attempt}.")
            return normalized
        except Exception as error:  # pylint: disable=broad-except
            last_error = error
            print(f"[render-start] Database not ready yet (attempt {attempt}/{attempts}): {error}")
            if attempt < attempts:
                time.sleep(delay_seconds)
    if last_error:
        raise last_error
    raise RuntimeError("Database readiness check failed without a concrete error.")


database_url = env.get("DATABASE_URL", "").strip()
if database_url:
    env["DATABASE_URL"] = _wait_for_database(database_url)

if run_migrations:
    try:
        subprocess.run(
            [sys.executable, "-m", "alembic", "upgrade", "head"],
            check=True,
            cwd=str(PROJECT_ROOT),
            env=env,
        )
        print("[render-start] Alembic migrations applied successfully.")
    except subprocess.CalledProcessError as error:
        if not allow_init_db_fallback:
            raise
        print(
            "[render-start] Alembic upgrade failed; falling back to app init_db startup path. "
            f"Exit status: {error.returncode}"
        )

os.execvpe(
    sys.executable,
    [
        sys.executable,
        "-m",
        "uvicorn",
        "backend.main:app",
        "--host",
        "0.0.0.0",
        "--port",
        port,
    ],
    env,
)
