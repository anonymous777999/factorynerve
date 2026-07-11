"""Render container startup for FactoryNerve backend."""

from __future__ import annotations

import os
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from sqlalchemy import create_engine, inspect, text


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

def _build_runtime_env() -> dict[str, str]:
    env = os.environ.copy()
    existing_pythonpath = env.get("PYTHONPATH", "").strip()
    paths = [str(PROJECT_ROOT)]
    if existing_pythonpath:
        paths.append(existing_pythonpath)
    env["PYTHONPATH"] = os.pathsep.join(paths)
    return env


def _build_alembic_env(env: dict[str, str]) -> dict[str, str]:
    """Build a copy of the runtime env with placeholders for optional validation.

    backend.database calls get_config() at import time, which validates
    required env vars including DATA_ENCRYPTION_KEY and at least one AI
    provider API key. Since both are sync:false in render.yaml they may
    not be set during initial deployments. Alembic only needs
    Base.metadata — it does not need real runtime credentials.

    Placeholders are injected ONLY into this copy. The original env
    passed to os.execvpe remains clean, so runtime uses real env vars
    (or fails naturally if they are truly missing).
    """
    alembic_env = {**env}
    if not alembic_env.get("DATA_ENCRYPTION_KEY"):
        alembic_env["DATA_ENCRYPTION_KEY"] = "a5jB6nrHnoZM5MFehyXYKBUklF7SkvIn_sS11-IGfmU="
    if not alembic_env.get("GROQ_API_KEY") and not alembic_env.get("ANTHROPIC_API_KEY") \
       and not alembic_env.get("GEMINI_API_KEY") and not alembic_env.get("OPENAI_API_KEY"):
        alembic_env["GROQ_API_KEY"] = "placeholder-sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    return alembic_env


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


def _inspect_alembic_state(url: str) -> tuple[set[str], bool]:
    engine = create_engine(url, future=True, pool_pre_ping=True)
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    has_version_row = False

    if "alembic_version" in table_names:
        with engine.connect() as connection:
            has_version_row = (
                connection.execute(text("SELECT version_num FROM alembic_version LIMIT 1")).scalar()
                is not None
            )

    engine.dispose()
    return table_names, has_version_row


def _run_init_db(runtime_env: dict[str, str]) -> None:
    os.environ.update(runtime_env)
    from backend.database import init_db

    init_db()


def _run_alembic(runtime_env: dict[str, str], command: list[str]) -> None:
    subprocess.run(
        [sys.executable, "-m", "alembic", *command],
        check=True,
        cwd=str(PROJECT_ROOT),
        env=runtime_env,
    )


def _print_env_status(env: dict[str, str]) -> None:
    """Print presence/absence of critical env vars to stdout (visible on Render)."""
    critical = ["DATABASE_URL", "DATA_ENCRYPTION_KEY", "JWT_SECRET_KEY",
                "JWT_EXPIRE_HOURS", "APP_NAME", "LOG_LEVEL", "AI_PROVIDER"]
    ai_keys = ["GROQ_API_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY", "OPENAI_API_KEY"]
    email_keys = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_FROM", "SMTP_DRY_RUN",
                  "RESEND_API_KEY", "SMTP_PASSWORD"]
    print("[render-start] === DIAGNOSTIC: Env var status ===", flush=True)
    for key in critical:
        val = env.get(key, "") or ""
        if val and key != "DATABASE_URL":
            print(f"[render-start]   {key}: PRESENT", flush=True)
        elif key == "DATABASE_URL":
            if "@" in val:
                print(f"[render-start]   {key}: ***@{val.split('@')[1][:30]}...", flush=True)
            else:
                print(f"[render-start]   {key}: {'PRESENT' if val else 'MISSING'}", flush=True)
        else:
            print(f"[render-start]   {key}: {'MISSING' if not val else 'PRESENT'}", flush=True)
    any_ai_key = any(env.get(k, "") for k in ai_keys)
    print(f"[render-start]   AI provider keys: {'PRESENT' if any_ai_key else 'MISSING'}", flush=True)
    print(f"[render-start]   --- Email / SMTP ---", flush=True)
    for key in email_keys:
        val = env.get(key, "") or ""
        if key in ("RESEND_API_KEY", "SMTP_PASSWORD"):
            if val:
                prefix = val[:6] if len(val) > 6 else val
                print(f"[render-start]   {key}: PRESENT (prefix={prefix}***)", flush=True)
            else:
                print(f"[render-start]   {key}: MISSING (set in Render dashboard)", flush=True)
        elif key == "SMTP_DRY_RUN":
            print(f"[render-start]   {key}: {val or 'NOT SET (defaults to false)'}", flush=True)
        else:
            print(f"[render-start]   {key}: {val or 'MISSING'}", flush=True)
    print("[render-start] === END DIAGNOSTIC ===", flush=True)


def _try_validate_runtime_settings(env: dict[str, str]) -> None:
    """Validate env vars that WILL crash the app at import time if missing/bad.

    Validates exactly what Pydantic's ``model_validator`` checks at module
    import time: Fernet key validity and AI provider key presence.
    Does NOT check vars with defaults (JWT_SECRET_KEY="", etc.) since those
    only fail at request time, not import time.

    Operates directly on the env dict WITHOUT importing backend.config
    (which may have cached Settings from Alembic's placeholder-laden env).
    """
    errors: list[str] = []
    # Fernet key validation — this crashes at import time in Pydantic model_validator
    dek = env.get("DATA_ENCRYPTION_KEY", "")
    if not dek:
        errors.append("DATA_ENCRYPTION_KEY is MISSING (will crash at import!)")
    else:
        try:
            from cryptography.fernet import Fernet
            Fernet(dek.encode("utf-8"))
        except Exception as e:
            errors.append(f"DATA_ENCRYPTION_KEY is INVALID: {e}")
    # AI provider key — Pydantic model_validator requires at least one
    ai_keys = [env.get(k, "") for k in ("GROQ_API_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY", "OPENAI_API_KEY")]
    if not any(ai_keys):
        errors.append("No AI provider key set (require at least one of: GROQ_API_KEY, ANTHROPIC_API_KEY, etc.)")
    if errors:
        for err in errors:
            print(f"[render-start] *** CRITICAL IMPORT-TIME ERROR: {err}", flush=True)
        print("[render-start] *** The app WILL crash at import when Pydantic Settings validates.", flush=True)
    else:
        print("[render-start] Import-time env validation: PASSED (all crash-causing vars are valid)", flush=True)


def main() -> None:
    env = _build_runtime_env()
    port = env.get("PORT", "10000")
    run_migrations = env.get("RUN_ALEMBIC_ON_STARTUP", "true").strip().lower() in {"1", "true", "yes", "on"}
    allow_init_db_fallback = env.get("ALLOW_INIT_DB_FALLBACK", "true").strip().lower() in {"1", "true", "yes", "on"}

    database_url = env.get("DATABASE_URL", "").strip()
    if database_url:
        env["DATABASE_URL"] = _wait_for_database(database_url)

    if run_migrations:
        # Use a separate env with safe placeholders for Alembic so that
        # missing sync:false env vars (DATA_ENCRYPTION_KEY, AI provider
        # keys) don't crash the migration. Runtime still uses the clean
        # env from _build_runtime_env().
        alembic_env = _build_alembic_env(env)
        try:
            if database_url:
                _, has_version_row = _inspect_alembic_state(alembic_env["DATABASE_URL"])
                if not has_version_row:
                    # No Alembic history — database is either fresh (no tables)
                    # or has legacy tables created outside Alembic. Either way,
                    # run init_db() to ensure all core tables (users,
                    # organizations, factories, …) exist before Alembic
                    # migrations reference them via foreign keys.
                    # init_db() is idempotent — Base.metadata.create_all uses
                    # SQLAlchemy's checkfirst=True (IF NOT EXISTS semantics).
                    # After creating tables, it stamps the Alembic head so
                    # future deploys can apply incremental migrations.
                    print(
                        "[render-start] No Alembic history found. "
                        "Running init_db to create all core tables..."
                    )
                    _run_init_db(alembic_env)
                    _run_alembic(alembic_env, ["stamp", "head"])
                    print("[render-start] Database initialized and Alembic history stamped to head.")
                else:
                    _run_alembic(alembic_env, ["upgrade", "head"])
                    print("[render-start] Alembic migrations applied successfully.")
            else:
                _run_alembic(alembic_env, ["upgrade", "head"])
                print("[render-start] Alembic migrations applied successfully.")
        except subprocess.CalledProcessError as error:
            if not allow_init_db_fallback:
                raise
            print(
                "[render-start] Alembic upgrade failed; falling back to app init_db startup path. "
                f"Exit status: {error.returncode}"
            )
            _run_init_db(alembic_env)
            print("[render-start] init_db completed; retrying alembic upgrade head.")
            try:
                _run_alembic(alembic_env, ["upgrade", "head"])
                print("[render-start] Alembic migrations applied successfully on retry after init_db.")
            except subprocess.CalledProcessError as retry_error:
                print(
                    "[render-start] Alembic upgrade retry also failed; falling back to stamp head. "
                    f"Exit status: {retry_error.returncode}"
                )
                try:
                    _run_alembic(alembic_env, ["stamp", "head"])
                    print("[render-start] Alembic history stamped to head after compatibility bootstrap.")
                except subprocess.CalledProcessError as stamp_error:
                    print(
                        "[render-start] Alembic stamp after compatibility bootstrap failed. "
                        f"Exit status: {stamp_error.returncode}"
                    )

    # ── PRE-FLIGHT DIAGNOSTIC: Validate env vars BEFORE starting uvicorn ──
    # This runs in the render_start.py process (NOT the uvicorn subprocess).
    # It prints critical env var status and tries to validate Pydantic Settings
    # with the ACTUAL runtime env (no placeholders) to catch config errors
    # before they cause silent 500s.
    _print_env_status(env)
    _try_validate_runtime_settings(env)

    print(f"[render-start] Starting uvicorn on port {port}...", flush=True)
    sys.stdout.flush()
    sys.stderr.flush()

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


if __name__ == "__main__":
    main()
