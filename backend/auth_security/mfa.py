"""TOTP-based MFA helpers."""

from __future__ import annotations

import os
import pyotp


def generate_secret() -> str:
    return pyotp.random_base32()


def provisioning_uri(*, email: str, secret: str) -> str:
    issuer = (os.getenv("AUTH_MFA_ISSUER") or "DPR.ai").strip()
    return pyotp.totp.TOTP(secret).provisioning_uri(name=email, issuer_name=issuer)


def verify_totp(*, secret: str, code: str) -> bool:
    totp = pyotp.TOTP(secret)
    return totp.verify(code, valid_window=1)
