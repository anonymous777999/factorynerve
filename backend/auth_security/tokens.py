"""Token helpers for sessions and password resets."""

from __future__ import annotations

import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired


def generate_token(bytes_len: int = 32) -> str:
    return secrets.token_urlsafe(bytes_len)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _serializer() -> URLSafeTimedSerializer:
    secret = os.getenv("AUTH_RESET_SECRET") or os.getenv("JWT_SECRET_KEY") or "dev-secret"
    return URLSafeTimedSerializer(secret_key=secret, salt="auth-reset")


def build_reset_token(payload: dict[str, Any]) -> str:
    return _serializer().dumps(payload)


def verify_reset_token(token: str, max_age_minutes: int) -> dict[str, Any]:
    try:
        return _serializer().loads(token, max_age=max_age_minutes * 60)
    except SignatureExpired as error:
        raise ValueError("Reset token expired.") from error
    except BadSignature as error:
        raise ValueError("Reset token invalid.") from error


def expires_at(minutes: int) -> datetime:
    return datetime.now(timezone.utc) + timedelta(minutes=minutes)
