"""Secure OTP generation and verification helpers."""

from __future__ import annotations

import bcrypt
import secrets


def generate_otp_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def hash_otp_code(otp_code: str) -> str:
    return bcrypt.hashpw(otp_code.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_otp_code(otp_code: str, otp_hash: str) -> bool:
    try:
        return bcrypt.checkpw(otp_code.encode("utf-8"), otp_hash.encode("utf-8"))
    except Exception:
        return False
