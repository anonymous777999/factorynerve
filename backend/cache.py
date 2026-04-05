"""Lightweight cache layer with optional Redis and safe in-memory fallback."""

from __future__ import annotations

from collections.abc import Callable
from datetime import date, datetime
import json
import logging
import os
import threading
import time
from enum import Enum
from typing import Any, TypeVar


logger = logging.getLogger(__name__)

try:  # pragma: no cover - optional dependency
    import redis  # type: ignore
except Exception:  # pragma: no cover - optional dependency
    redis = None


T = TypeVar("T")
_MEMORY_LIMIT = int(os.getenv("CACHE_MEMORY_MAX_ITEMS", "512"))
_lock = threading.Lock()
_memory_cache: dict[str, tuple[float, str]] = {}
_redis_client = None
_redis_failed = False


def json_default(value: Any) -> Any:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Enum):
        return value.value
    if hasattr(value, "model_dump"):
        return value.model_dump(mode="json")
    raise TypeError(f"Object of type {type(value).__name__} is not JSON serializable")


def get_redis_client():
    global _redis_client, _redis_failed
    if _redis_client is not None or _redis_failed:
        return _redis_client
    redis_url = (os.getenv("REDIS_URL") or "").strip()
    if not redis_url or redis is None:
        _redis_failed = True
        return None
    try:  # pragma: no cover - depends on external Redis availability
        client = redis.from_url(redis_url, decode_responses=True)
        client.ping()
        _redis_client = client
        logger.info("Redis cache connected.")
    except Exception:
        logger.warning("Redis cache unavailable. Falling back to in-memory cache.")
        _redis_failed = True
        _redis_client = None
    return _redis_client


def build_cache_key(*parts: Any) -> str:
    return ":".join(str(part) for part in parts if part not in (None, ""))


def get_json(key: str) -> Any | None:
    client = get_redis_client()
    if client is not None:  # pragma: no branch - small wrapper
        try:  # pragma: no cover - depends on Redis runtime
            raw = client.get(key)
            return json.loads(raw) if raw else None
        except Exception:
            logger.warning("Redis get failed for cache key %s. Falling back to memory cache.", key)

    now = time.time()
    with _lock:
        cached = _memory_cache.get(key)
        if not cached:
            return None
        expires_at, payload = cached
        if expires_at <= now:
            _memory_cache.pop(key, None)
            return None
        return json.loads(payload)


def set_json(key: str, value: Any, ttl_seconds: int) -> None:
    payload = json.dumps(value, default=json_default)
    client = get_redis_client()
    if client is not None:
        try:  # pragma: no cover - depends on Redis runtime
            client.setex(key, max(1, ttl_seconds), payload)
            return
        except Exception:
            logger.warning("Redis set failed for cache key %s. Falling back to memory cache.", key)

    expires_at = time.time() + max(1, ttl_seconds)
    with _lock:
        if len(_memory_cache) >= _MEMORY_LIMIT:
            oldest_keys = sorted(_memory_cache.items(), key=lambda item: item[1][0])[: max(1, _MEMORY_LIMIT // 8)]
            for stale_key, _ in oldest_keys:
                _memory_cache.pop(stale_key, None)
        _memory_cache[key] = (expires_at, payload)


def delete_prefix(prefix: str) -> None:
    client = get_redis_client()
    if client is not None:
        try:  # pragma: no cover - depends on Redis runtime
            keys = list(client.scan_iter(match=f"{prefix}*"))
            if keys:
                client.delete(*keys)
        except Exception:
            logger.warning("Redis delete-prefix failed for %s. Continuing with memory cache cleanup.", prefix)

    with _lock:
        keys = [key for key in _memory_cache.keys() if key.startswith(prefix)]
        for key in keys:
            _memory_cache.pop(key, None)


def get_or_set_json(key: str, ttl_seconds: int, factory: Callable[[], T]) -> T:
    cached = get_json(key)
    if cached is not None:
        return cached
    value = factory()
    set_json(key, value, ttl_seconds)
    return value
