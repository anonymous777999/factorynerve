"""Password hashing and policy enforcement (Argon2)."""

from __future__ import annotations

import re
from dataclasses import dataclass

from passlib.context import CryptContext


_pwd_context = CryptContext(
    schemes=["argon2"],
    deprecated="auto",
)


@dataclass(frozen=True)
class PasswordPolicy:
    min_length: int = 12
    require_upper: bool = True
    require_lower: bool = True
    require_digit: bool = True
    require_symbol: bool = True


def hash_password(password: str) -> str:
    return _pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _pwd_context.verify(password, password_hash)
    except Exception:
        return False


def validate_password_strength(password: str, *, policy: PasswordPolicy | None = None) -> None:
    policy = policy or PasswordPolicy()
    if len(password) < policy.min_length:
        raise ValueError(f"Password must be at least {policy.min_length} characters.")
    if policy.require_upper and not re.search(r"[A-Z]", password):
        raise ValueError("Password must include at least one uppercase letter.")
    if policy.require_lower and not re.search(r"[a-z]", password):
        raise ValueError("Password must include at least one lowercase letter.")
    if policy.require_digit and not re.search(r"\d", password):
        raise ValueError("Password must include at least one number.")
    if policy.require_symbol and not re.search(r"[^A-Za-z0-9]", password):
        raise ValueError("Password must include at least one symbol.")
