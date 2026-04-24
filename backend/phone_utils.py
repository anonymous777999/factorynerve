"""Phone normalization and masking helpers."""

from __future__ import annotations

import re

import phonenumbers

from backend.database import hash_ip_address


def normalize_phone_e164(value: str | None, *, default_region: str = "IN") -> str:
    raw = str(value or "").strip()
    if not raw:
        raise ValueError("Phone number is required.")
    try:
        parsed = phonenumbers.parse(raw, default_region)
    except phonenumbers.NumberParseException as error:
        raise ValueError("Phone number must be a valid international number.") from error
    if not phonenumbers.is_possible_number(parsed):
        raise ValueError("Phone number must be a valid international number.")
    e164 = phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
    digits = re.sub(r"\D", "", e164)
    if len(digits) < 7 or len(digits) > 15:
        raise ValueError("Phone number must contain 7 to 15 digits.")
    return e164


def mask_phone_number(phone_e164: str | None) -> str:
    raw = str(phone_e164 or "").strip()
    if not raw:
        return "-"
    if not raw.startswith("+"):
        raw = f"+{raw}"
    digits = re.sub(r"\D", "", raw)
    if len(digits) <= 4:
        return f"+{'*' * max(2, len(digits))}"
    country_prefix = digits[:2] if len(digits) > 10 else digits[:1]
    suffix = digits[-4:]
    masked_middle = "*" * max(4, len(digits) - len(country_prefix) - len(suffix))
    return f"+{country_prefix}{masked_middle}{suffix}"


def hash_ip_for_rate_limit(ip_address: str | None) -> str:
    return hash_ip_address(ip_address or "") or "unknown"
