"""DB-backed rate limiting with automatic in-memory fallback.

Uses the ``rate_limits`` table with ``SELECT ... FOR UPDATE`` for atomic
read-and-increment.  Falls back to the legacy in-memory sliding window
when the database is unreachable (e.g. during connection pool exhaustion).
"""

from __future__ import annotations

import logging
import threading
import time
from collections import defaultdict, deque
from datetime import datetime, timezone, timedelta

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from backend.database import SessionLocal
from backend.models.rate_limit import RateLimit


logger = logging.getLogger(__name__)


class RateLimitError(RuntimeError):
    def __init__(self, detail: str) -> None:
        super().__init__(detail)
        self.detail = detail


# ── In-memory fallback (unchanged from auth_security/rate_limit.py) ─────
_fallback_lock = threading.Lock()
_fallback_buckets: dict[str, deque[float]] = defaultdict(deque)


def _check_fallback(*, key: str, max_requests: int, window_seconds: int) -> None:
    if max_requests <= 0:
        return
    now = time.time()
    with _fallback_lock:
        history = _fallback_buckets[key]
        while history and now - history[0] > window_seconds:
            history.popleft()
        if len(history) >= max_requests:
            raise RateLimitError("Too many attempts. Please try again later.")
        history.append(now)


# ── DB-backed primary ──────────────────────────────────────────────────


def check_rate_limit(
    *,
    key: str,
    max_requests: int,
    window_seconds: int,
    db: Session | None = None,
) -> None:
    """Check and record a rate-limit event.

    Uses PostgreSQL row-level locking (``SELECT … FOR UPDATE``) when a
    *db* session is provided or can be borrowed from the pool.  Falls back
    to in-memory when the DB is unreachable.
    """
    if max_requests <= 0:
        return

    session: Session | None = db
    own_session = False
    try:
        if session is None:
            session = SessionLocal()
            own_session = True

        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(seconds=window_seconds)

        # Lock the row (or empty result) so concurrent requests serialise
        row = (
            session.execute(
                select(RateLimit).filter(RateLimit.key == key).with_for_update()
            )
            .scalars()
            .first()
        )

        if row is None or row.expires_at <= now:
            # Start a new window — delete stale row, insert fresh
            if row is not None:
                session.delete(row)
                session.flush()
            session.add(
                RateLimit(
                    key=key,
                    count=1,
                    window_start=now,
                    expires_at=expires_at,
                )
            )
            session.commit()
            return

        # Existing valid window — check limit
        if row.count >= max_requests:
            session.rollback()
            raise RateLimitError("Too many attempts. Please try again later.")

        row.count = (row.count or 0) + 1
        session.commit()

    except Exception as exc:  # pylint: disable=broad-except
        logger.warning("DbRateLimit fallback for key=%s: %s", key, exc)
        _check_fallback(key=key, max_requests=max_requests, window_seconds=window_seconds)
    finally:
        if own_session and session is not None:
            session.close()
