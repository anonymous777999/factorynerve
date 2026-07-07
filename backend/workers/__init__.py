"""rq worker package for background task processing.

Each module exposes:
- ``enqueue_job()`` — schedules the job via rq
- ``job_function()`` — the actual work performed by the rq worker process

Health and configuration:
- All workers connect to Redis via ``redis.from_url(url)``
- Queue names follow the pattern ``dpr:<service_name>``
- Workers are independent processes — crashes don't affect the web process
"""

from __future__ import annotations

import os

import redis
from rq import Queue

_REDIS_URL: str | None = os.getenv("REDIS_URL")
_RQ_CONNECTION = None
_CODEC_CONNECTION = None


def _get_redis_connection():
    """Lazily initialise and return a Redis connection for rq.

    IMPORTANT: Does NOT use ``decode_responses=True`` because rq
    serialises job payloads as pickled bytes and expects raw byte
    responses from Redis. Using ``decode_responses=True`` would
    silently corrupt every enqueued job.
    """
    global _RQ_CONNECTION
    if _RQ_CONNECTION is None and _REDIS_URL:
        _RQ_CONNECTION = redis.from_url(_REDIS_URL)  # binary — rq needs bytes
    return _RQ_CONNECTION




def get_queue(name: str = "default") -> Queue | None:
    """Return an rq Queue, or None if Redis is unavailable."""
    conn = _get_redis_connection()
    if conn is None:
        return None
    return Queue(name, connection=conn)
