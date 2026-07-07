"""Minimal conftest for unit tests.

Overrides the session-scoped ``ensure_backend`` fixture from
``tests/conftest.py`` with a no-op so pure unit tests in this
directory can run without starting a FastAPI/uvicorn server.
"""

from __future__ import annotations

import os
from pathlib import Path
from uuid import uuid4
from cryptography.fernet import Fernet

import pytest


# ── Ensure environment is set up the same way as the parent conf ────────
# The parent conftest sets these env vars at module import time.
# We replicate the key ones here in case the module hasn't been imported yet.
_TEST_DB_PATH = Path(__file__).resolve().parents[2] / f"test_runtime_{uuid4().hex[:8]}.db"
_TEST_DATABASE_URL = os.getenv("DPR_TEST_DATABASE_URL", f"sqlite:///{_TEST_DB_PATH.as_posix()}")

os.environ.setdefault("DATABASE_URL", _TEST_DATABASE_URL)
os.environ.setdefault("JWT_SECRET_KEY", "test-secret")
os.environ.setdefault("DATA_ENCRYPTION_KEY", Fernet.generate_key().decode("utf-8"))
os.environ.setdefault("AI_PROVIDER", "groq")
os.environ.setdefault("GROQ_API_KEY", "test")
os.environ.setdefault("ANTHROPIC_API_KEY", "test")
os.environ.setdefault("AI_PROVIDER_TIMEOUT_SECONDS", "1")


@pytest.fixture(scope="session", autouse=True)
def ensure_backend() -> None:
    """Override the parent conftest's session-scoped backend startup.

    Unit tests in this directory do not need a running backend server.
    This no-op fixture replaces the parent's ``ensure_backend`` fixture
    which would otherwise try to start uvicorn.
    """
    return None
