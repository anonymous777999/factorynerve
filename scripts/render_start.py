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
db_wait_attempts = max(1, int(env.get("DB_WAIT_ATTEMPTS", "40")))
db_wait_delay_seconds = max(1, int(env.get("DB_WAIT_DELAY_SECONDS", "3")))
db_connect_timeout_seconds = max(2, int(env.get("DB_CONNECT_TIMEOUT_SECONDS", "5")))


def _format_db_target(url: str) -> str:
    parts = urlsplit(url)
    host = parts.hostname or "unknown-host"
    port = parts.port or 5432
    database = parts.path.lstrip("/") or "(default)"
    return f"{host}:{port}/{database}"


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

    parts = urlsplit(normalized)
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    query.setdefault("connect_timeout", str(db_connect_timeout_seconds))
    normalized = urlunsplit(
        (parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment)
    )

    return normalized


def _wait_for_database(url: str, *, attempts: int = 20, delay_seconds: int = 3) -> str:
    normalized = _normalize_database_url(url)
    engine = create_engine(normalized, future=True, pool_pre_ping=True)
    last_error: Exception | None = None
    target = _format_db_target(normalized)
    try:
        for attempt in range(1, attempts + 1):
            try:
                with engine.connect() as connection:
                    connection.execute(text("SELECT 1"))
                print(f"[render-start] Database connection ready for {target} on attempt {attempt}.")
                return normalized
            except Exception as error:  # pylint: disable=broad-except
                last_error = error
                print(
                    f"[render-start] Database not ready yet for {target} "
                    f"(attempt {attempt}/{attempts}): {error}"
                )
                if attempt < attempts:
                    time.sleep(delay_seconds)
    finally:
        engine.dispose()
    if last_error:
        raise last_error
    raise RuntimeError("Database readiness check failed without a concrete error.")


database_url = env.get("DATABASE_URL", "").strip()
if database_url:
    fallback_database_url = (
        env.get("DATABASE_FALLBACK_URL", "").strip()
        or env.get("DATABASE_EXTERNAL_URL", "").strip()
    )
    try:
        env["DATABASE_URL"] = _wait_for_database(
            database_url,
            attempts=db_wait_attempts,
            delay_seconds=db_wait_delay_seconds,
        )
    except Exception as primary_error:  # pylint: disable=broad-except
        if not fallback_database_url or fallback_database_url == database_url:
            raise
        print(
            "[render-start] Primary database URL stayed unavailable. "
            "Trying configured fallback database URL. "
            f"Primary target: {_format_db_target(_normalize_database_url(database_url))}"
        )
        try:
            env["DATABASE_URL"] = _wait_for_database(
                fallback_database_url,
                attempts=db_wait_attempts,
                delay_seconds=db_wait_delay_seconds,
            )
        except Exception as fallback_error:  # pylint: disable=broad-except
            raise RuntimeError(
                "Both primary and fallback database URLs were unreachable. "
                "On Render, the internal database URL requires the web service and database "
                "to be in the same account and region."
            ) from fallback_error
        else:
            print(
                "[render-start] Using fallback database URL after primary failed with: "
                f"{primary_error}"
            )

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
