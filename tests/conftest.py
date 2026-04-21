import os
import subprocess
import sys
import time
from pathlib import Path
import socket
from urllib.parse import urlparse
from uuid import uuid4

from cryptography.fernet import Fernet
import httpx
import pytest


CONFIGURED_BASE_URL = os.getenv("DPR_TEST_BASE_URL", "http://127.0.0.1:8765")
USE_EXISTING_SERVER = os.getenv("DPR_TEST_USE_EXISTING_SERVER") == "1"
PROJECT_ROOT = Path(__file__).resolve().parents[1]
SERVER_AVAILABLE = False
_SERVER_PROCESS: subprocess.Popen | None = None
_SELECTED_BASE_URL = CONFIGURED_BASE_URL
_EXPLICIT_TEST_DATABASE_URL = os.getenv("DPR_TEST_DATABASE_URL")
_TEST_DB_PATH: Path | None = None
if _EXPLICIT_TEST_DATABASE_URL:
    _TEST_DATABASE_URL = _EXPLICIT_TEST_DATABASE_URL
else:
    _TEST_DB_PATH = PROJECT_ROOT / f"test_runtime_{uuid4().hex[:8]}.db"
    _TEST_DATABASE_URL = f"sqlite:///{_TEST_DB_PATH.as_posix()}"

os.environ["DATABASE_URL"] = _TEST_DATABASE_URL
for key in ("GROQ_API_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY", "OPENAI_API_KEY"):
    os.environ.pop(key, None)
os.environ.setdefault("AI_PROVIDER", "groq")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-for-auth-suite-1234567890")
os.environ.setdefault("JWT_ACCESS_TOKEN_MINUTES", "15")
os.environ.setdefault("JWT_EXPIRE_HOURS", "1")
os.environ.setdefault("AUTH_RESET_SECRET", "test-reset-secret-for-auth-suite-1234567890")
os.environ.setdefault("APP_NAME", "DPR.ai")
os.environ.setdefault("LOG_LEVEL", "INFO")
os.environ.setdefault("DATA_ENCRYPTION_KEY", Fernet.generate_key().decode("utf-8"))
os.environ.setdefault("AI_PROVIDER_TIMEOUT_SECONDS", "1")
os.environ.setdefault("AI_PROVIDER_RETRY_ATTEMPTS", "1")
os.environ.setdefault("AI_PROVIDER_RETRY_BACKOFF_SECONDS", "0")
os.environ.setdefault("RATE_LIMIT_MAX_REQUESTS", "5000")
os.environ.setdefault("AUTH_RATE_LIMIT_MAX_ATTEMPTS", "5000")
os.environ.setdefault("EMAIL_VERIFICATION_EXPOSE_LINK", "1")
os.environ.setdefault("PASSWORD_RESET_EXPOSE_LINK", "1")
os.environ.setdefault("SMTP_DRY_RUN", "1")
os.environ.setdefault("DISABLE_EXTERNAL_AI", "1")
os.environ.setdefault("JWT_COOKIE_SAMESITE", "Strict")
os.environ.setdefault("AUTH_SESSION_SAMESITE", "Strict")


def _server_available(url: str) -> bool:
    try:
        resp = httpx.get(f"{url}/health", timeout=2.0)
        return resp.status_code == 200
    except Exception:
        return False


def _pick_free_base_url() -> str:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        host, port = sock.getsockname()
    return f"http://{host}:{port}"


def _start_server(base_url: str) -> subprocess.Popen:
    parsed = urlparse(base_url)
    host = parsed.hostname or "127.0.0.1"
    port = parsed.port or 8765
    env = os.environ.copy()
    env["DATABASE_URL"] = _TEST_DATABASE_URL
    cmd = [
        sys.executable,
        "-m",
        "uvicorn",
        "backend.main:app",
        "--host",
        host,
        "--port",
        str(port),
    ]
    return subprocess.Popen(
        cmd,
        cwd=str(PROJECT_ROOT),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        env=env,
    )


@pytest.fixture(scope="session", autouse=True)
def ensure_backend():
    global SERVER_AVAILABLE, _SERVER_PROCESS, _SELECTED_BASE_URL
    if USE_EXISTING_SERVER and _server_available(CONFIGURED_BASE_URL):
        SERVER_AVAILABLE = True
        _SELECTED_BASE_URL = CONFIGURED_BASE_URL
        yield
        return

    _SELECTED_BASE_URL = CONFIGURED_BASE_URL if os.getenv("DPR_TEST_BASE_URL") else _pick_free_base_url()
    _SERVER_PROCESS = _start_server(_SELECTED_BASE_URL)
    startup_error = ""
    for _ in range(40):
        if _server_available(_SELECTED_BASE_URL):
            SERVER_AVAILABLE = True
            break
        if _SERVER_PROCESS.poll() is not None:
            startup_error = f"Backend process exited early with code {_SERVER_PROCESS.returncode}."
            break
        time.sleep(0.5)

    if not SERVER_AVAILABLE:
        if _SERVER_PROCESS and _SERVER_PROCESS.poll() is None:
            _SERVER_PROCESS.terminate()
            try:
                _SERVER_PROCESS.wait(timeout=5)
            except Exception:
                _SERVER_PROCESS.kill()
        message = (
            f"Test backend did not become healthy at {_SELECTED_BASE_URL}/health. "
            f"{startup_error or 'Check DATABASE_URL, API keys, and startup logs.'}"
        )
        pytest.fail(message)

    yield
    if _SERVER_PROCESS and _SERVER_PROCESS.poll() is None:
        _SERVER_PROCESS.terminate()
        try:
            _SERVER_PROCESS.wait(timeout=5)
        except Exception:
            _SERVER_PROCESS.kill()
    if _TEST_DB_PATH and _TEST_DB_PATH.exists():
        try:
            _TEST_DB_PATH.unlink()
        except OSError:
            pass


@pytest.fixture(scope="session")
def base_url() -> str:
    return _SELECTED_BASE_URL


@pytest.fixture
def http_client(base_url: str):
    client = httpx.Client(base_url=base_url, timeout=20.0)
    try:
        yield client
    finally:
        client.close()
