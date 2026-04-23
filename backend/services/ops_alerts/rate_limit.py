"""Cooldown and deduplication helpers for operational alerts."""

from __future__ import annotations

import threading
import time
from typing import Protocol

from backend.cache import get_redis_client


class AlertRateLimiter(Protocol):
    def acquire(self, dedup_key: str, cooldown_seconds: int) -> bool:
        """Reserve a dedup window and return True when the alert may proceed."""

    def release(self, dedup_key: str) -> None:
        """Release a reserved dedup window when enqueueing fails."""


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
        return bool(
            self._client.set(
                self._key(dedup_key),
                "1",
                nx=True,
                ex=max(1, cooldown_seconds),
            )
        )

    def release(self, dedup_key: str) -> None:
        try:
            self._client.delete(self._key(dedup_key))
        except Exception:
            pass


def build_rate_limiter() -> AlertRateLimiter:
    client = get_redis_client()
    if client is not None:
        return RedisAlertRateLimiter(client)
    return InMemoryAlertRateLimiter()
