"""Cooldown, deduplication, and org-level alert limiting helpers."""

from __future__ import annotations

import logging
import threading
import time
from typing import Protocol

from backend.cache import get_redis_client


logger = logging.getLogger(__name__)


class AlertRateLimiter(Protocol):
    def acquire(self, dedup_key: str, cooldown_seconds: int) -> bool:
        """Reserve a dedup window and return True when the alert may proceed."""

    def release(self, dedup_key: str) -> None:
        """Release a reserved dedup window when enqueueing fails."""


class OrgAlertRateLimiter(Protocol):
    def acquire(self, org_key: str, *, severity_bucket: str, window_seconds: int, limit: int) -> bool:
        """Return True when the org may emit another alert in the active window."""


class InMemoryAlertRateLimiter:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._entries: dict[str, float] = {}

    def acquire(self, dedup_key: str, cooldown_seconds: int) -> bool:
        now = time.time()
        with self._lock:
            expires_at = self._entries.get(dedup_key)
            if expires_at and expires_at > now:
                return False
            self._entries[dedup_key] = now + max(1, cooldown_seconds)
            stale_keys = [key for key, value in self._entries.items() if value <= now]
            for key in stale_keys:
                self._entries.pop(key, None)
            return True

    def release(self, dedup_key: str) -> None:
        with self._lock:
            self._entries.pop(dedup_key, None)


class RedisAlertRateLimiter:
    def __init__(self, client) -> None:
        self._client = client

    @staticmethod
    def _key(dedup_key: str) -> str:
        return f"ops-alerts:cooldown:{dedup_key}"

    def acquire(self, dedup_key: str, cooldown_seconds: int) -> bool:
        try:
            return bool(
                self._client.set(
                    self._key(dedup_key),
                    "1",
                    nx=True,
                    ex=max(1, cooldown_seconds),
                )
            )
        except Exception:  # pragma: no cover - depends on Redis runtime
            logger.warning("Redis dedupe acquire failed for %s; allowing alert.", dedup_key)
            return True

    def release(self, dedup_key: str) -> None:
        try:
            self._client.delete(self._key(dedup_key))
        except Exception:  # pragma: no cover - depends on Redis runtime
            pass


class InMemoryOrgAlertRateLimiter:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._entries: dict[str, tuple[int, int]] = {}

    def acquire(self, org_key: str, *, severity_bucket: str, window_seconds: int, limit: int) -> bool:
        if limit <= 0:
            return False
        window = max(1, window_seconds)
        slot = int(time.time() // window)
        key = f"{org_key}:{severity_bucket}"
        with self._lock:
            current_slot, count = self._entries.get(key, (slot, 0))
            if current_slot != slot:
                current_slot, count = slot, 0
            count += 1
            self._entries[key] = (current_slot, count)
            stale = [entry_key for entry_key, (entry_slot, _) in self._entries.items() if entry_slot != slot]
            for stale_key in stale:
                self._entries.pop(stale_key, None)
            return count <= limit


class RedisOrgAlertRateLimiter:
    def __init__(self, client) -> None:
        self._client = client

    @staticmethod
    def _key(org_key: str, severity_bucket: str, window_seconds: int) -> str:
        slot = int(time.time() // max(1, window_seconds))
        return f"ops-alerts:org-limit:{org_key}:{severity_bucket}:{slot}"

    def acquire(self, org_key: str, *, severity_bucket: str, window_seconds: int, limit: int) -> bool:
        if limit <= 0:
            return False
        key = self._key(org_key, severity_bucket, window_seconds)
        try:
            count = int(self._client.incr(key))
            if count == 1:
                self._client.expire(key, max(1, window_seconds) + 5)
            return count <= limit
        except Exception:  # pragma: no cover - depends on Redis runtime
            logger.warning("Redis org rate limit failed for %s; allowing alert.", org_key)
            return True


def build_rate_limiter() -> AlertRateLimiter:
    client = get_redis_client()
    if client is not None:
        return RedisAlertRateLimiter(client)
    return InMemoryAlertRateLimiter()


def build_org_rate_limiter() -> OrgAlertRateLimiter:
    client = get_redis_client()
    if client is not None:
        return RedisOrgAlertRateLimiter(client)
    return InMemoryOrgAlertRateLimiter()
