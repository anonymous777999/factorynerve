"""
Indian Number Normalizer — parses and formats Indian number system values.

Indian grouping: 47,22,000 = 47 lakh 22 thousand = 4,722,000
This is NOT the same as Western 4,722,000.

Examples:
    "47,22,000"   -> 4722000
    "1,00,000"    -> 100000
    "10,00,000"   -> 1000000
    "1,00,00,000" -> 10000000
    "14,000"      -> 14000
    "Rs.47,22,000"-> 4722000  (strip prefix)
    "0.450"       -> 0.45     (decimal for MT weights)
    "4722000"     -> 4722000  (plain integer)
"""

from __future__ import annotations

import re
from typing import Any, Union


def parse_indian_number(value: str | None) -> int | float | None:
    """
    Parse Indian number format to int or float.

    Handles:
    - Indian comma grouping (47,22,000 → 4722000)
    - Currency prefixes: ₹, Rs., Re., रु.
    - Unit suffixes: MT, KG, KGS, NOS, PCS, MM, M, L, KL, m³, kWH, kVAH, kVARH, kVA
    - Decimals: 0.450 → 0.45
    """
    if not value:
        return None

    s = str(value).strip()

    # Strip currency prefixes: ₹ (devnagri), Rs, Re, रु (hindi)
    s = re.sub(r'^[₹\u20b9Rr][sS]?\.?\s*', '', s)

    # Strip unit suffixes
    s = re.sub(
        r'\s*(MT|KG|KGS|NOS|PCS|MM|M\b|L\b|KL|m³|kWH|kVAH|kVARH|kVA)\s*$',
        '', s, flags=re.IGNORECASE
    )

    s = s.strip()
    if not s:
        return None

    # Remove all commas — Indian grouping commas are visual only after parsing
    no_commas = s.replace(',', '')

    # Handle empty after stripping
    if not no_commas:
        return None

    # Decimal check
    if '.' in no_commas:
        try:
            return round(float(no_commas), 6)
        except ValueError:
            return None

    # Pure integer
    try:
        return int(no_commas)
    except ValueError:
        return None


def format_indian_number(value: int | None) -> str:
    """
    Format integer to Indian number system string.

    Examples:
        4722000  -> "47,22,000"
        100000   -> "1,00,000"
        14000    -> "14,000"
        999      -> "999"
    """
    if value is None:
        return ""

    is_negative = value < 0
    s = str(abs(int(value)))

    if len(s) <= 3:
        result = s
    else:
        # Last 3 digits, then groups of 2
        result = s[-3:]
        s = s[:-3]
        while s:
            result = s[-2:] + ',' + result
            s = s[:-2]

    return ('-' if is_negative else '') + result


def is_indian_number(value: str) -> bool:
    """
    Detect if a string is likely an Indian-formatted number.
    Pattern: optional ₹, then digits with Indian comma grouping (X,XX,XXX or X,XX,XXX.XX).
    """
    cleaned = re.sub(r'^[₹Rs.\s]+', '', str(value).strip())
    # Indian pattern: X,XX,XXX or X,XX,XXX.XX
    return bool(re.match(r'^\d{1,2}(,\d{2})*,\d{3}(\.\d+)?$', cleaned))


def normalise_cell_value(raw: Any) -> dict[str, Any]:
    """
    Normalise a single cell value for Excel export.

    Returns dict with:
        - value: original string (preserved as-is)
        - normalized: integer, float, or None
        - is_numeric: True if successfully parsed
        - formatted_indian: reformatted Indian number string if numeric

    Usage:
        norm = normalise_cell_value("47,22,000")
        # => {"value": "47,22,000", "normalized": 4722000, "is_numeric": True,
        #     "formatted_indian": "47,22,000"}
    """
    if raw is None:
        return {"value": None, "normalized": None, "is_numeric": False}

    s = str(raw).strip()
    if not s:
        return {"value": raw, "normalized": None, "is_numeric": False}

    parsed = parse_indian_number(s)
    if parsed is not None:
        return {
            "value": s,
            "normalized": parsed,
            "is_numeric": True,
            "formatted_indian": format_indian_number(int(parsed))
            if isinstance(parsed, int) else str(parsed),
        }

    return {"value": s, "normalized": None, "is_numeric": False}
