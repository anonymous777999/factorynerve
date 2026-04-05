"""Run DPR.ai services from one command.

Streamlit has been removed. This launcher starts only FastAPI.
"""

from __future__ import annotations

import logging
import os
import signal
import subprocess
import sys
import time
from pathlib import Path
from typing import List

from dotenv import load_dotenv


ROOT_DIR = Path(__file__).resolve().parent
BACKEND_APP = "backend.main:app"
DEFAULT_FASTAPI_PORT = 8765
DEFAULT_FASTAPI_HOST = "127.0.0.1"


def _to_bool(value: str | None) -> bool:
    if value is None:
        return False
    return value.strip().lower() in {"1", "true", "yes", "on"}


def configure_logging() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")


def start_process(command: List[str], name: str) -> subprocess.Popen:
    try:
        logging.info("Starting %s...", name)
        return subprocess.Popen(command, cwd=ROOT_DIR)  # noqa: S603
    except FileNotFoundError as error:
        logging.error("Failed to start %s. Command not found: %s", name, command[0])
        raise RuntimeError(f"{name} start failed: {error}") from error
    except Exception as error:  # pylint: disable=broad-except
        logging.exception("Unexpected error while starting %s", name)
        raise RuntimeError(f"{name} start failed: {error}") from error


def terminate_process(proc: subprocess.Popen, name: str) -> None:
    if proc.poll() is not None:
        return
    logging.info("Stopping %s...", name)
    proc.terminate()
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        logging.warning("%s did not stop in time. Killing process...", name)
        proc.kill()
        proc.wait(timeout=5)


def get_port(env_key: str, default_port: int) -> int:
    raw_value = os.getenv(env_key, str(default_port))
    try:
        port = int(raw_value)
        if not 1 <= port <= 65535:
            raise ValueError("Port out of valid range.")
        return port
    except (TypeError, ValueError):
        logging.warning("Invalid %s value '%s'. Falling back to %s.", env_key, raw_value, default_port)
        return default_port


def get_host(env_key: str, default_host: str) -> str:
    raw_value = os.getenv(env_key, default_host)
    value = raw_value.strip()
    if value:
        return value
    return default_host


def main() -> int:
    configure_logging()
    load_dotenv(ROOT_DIR / ".env")

    fastapi_port = get_port("FASTAPI_PORT", DEFAULT_FASTAPI_PORT)
    fastapi_host = get_host("FASTAPI_HOST", DEFAULT_FASTAPI_HOST)
    disable_reload = _to_bool(os.getenv("DPR_NO_RELOAD"))

    backend_cmd = [
        sys.executable,
        "-m",
        "uvicorn",
        BACKEND_APP,
        "--host",
        fastapi_host,
        "--port",
        str(fastapi_port),
    ]
    if not disable_reload:
        backend_cmd.insert(-2, "--reload")

    backend_proc: subprocess.Popen | None = None

    def shutdown_handler(signum: int, _frame: object) -> None:
        logging.info("Received shutdown signal: %s", signum)
        if backend_proc:
            terminate_process(backend_proc, "FastAPI backend")
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown_handler)
    signal.signal(signal.SIGTERM, shutdown_handler)

    try:
        backend_proc = start_process(backend_cmd, "FastAPI backend")
        logging.info("DPR.ai backend started. Press Ctrl+C to stop.")
        while True:
            if backend_proc.poll() is not None:
                logging.error("FastAPI backend exited unexpectedly.")
                return backend_proc.returncode or 1
            time.sleep(1)
    except Exception as error:  # pylint: disable=broad-except
        logging.exception("Fatal launcher error: %s", error)
        return 1
    finally:
        if backend_proc:
            terminate_process(backend_proc, "FastAPI backend")


if __name__ == "__main__":
    raise SystemExit(main())
