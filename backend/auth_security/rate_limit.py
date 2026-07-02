"""Rate limiting — delegates to DB-backed implementation with in-memory fallback.

This module re-exports ``check_rate_limit`` and ``RateLimitError`` from the
DB-backed implementation so that existing callers (``auth_secure.py``,
``feedback.py``, etc.) continue to work without import changes.
"""

from backend.auth_security.db_rate_limit import RateLimitError, check_rate_limit

__all__ = ["RateLimitError", "check_rate_limit"]
