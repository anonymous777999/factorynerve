"""Lightweight conftest for failure simulation tests.

Overrides the session-scoped ensure_backend fixture from tests/conftest.py
so these tests can run without starting a full uvicorn server.
Tests use TestClient(app) directly.
"""

from __future__ import annotations

import os
from pathlib import Path
from uuid import uuid4
from cryptography.fernet import Fernet

import pytest

# Set minimal env vars before any imports
os.environ.setdefault("APP_ENV", "development")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret")
os.environ.setdefault("AI_PROVIDER", "groq")
os.environ.setdefault("GROQ_API_KEY", "test")
os.environ.setdefault("ANTHROPIC_API_KEY", "test")
os.environ.setdefault("DATA_ENCRYPTION_KEY", Fernet.generate_key().decode("utf-8"))
os.environ.setdefault("DATABASE_URL", f"sqlite:///{Path(__file__).resolve().parents[2] / f'test_failure_{uuid4().hex[:8]}.db'}")
os.environ.setdefault("SMTP_DRY_RUN", "1")


@pytest.fixture(scope="session", autouse=True)
def ensure_backend() -> None:
    """Override the parent conftest's session-scoped backend startup.

    Failure simulation tests do not need a running backend server.
    They use TestClient(app) directly.
    """
    return None
