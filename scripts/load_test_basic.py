"""Basic load test runner for DPR.ai (no external deps)."""

from __future__ import annotations

import os
import threading
import time
from queue import Queue
from typing import Any

import requests


API_BASE = os.getenv("API_BASE_URL", "http://127.0.0.1:8765").rstrip("/")
TARGET_PATH = os.getenv("LOAD_TEST_PATH", "/health")
CONCURRENCY = int(os.getenv("LOAD_TEST_CONCURRENCY", "10"))
REQUESTS = int(os.getenv("LOAD_TEST_REQUESTS", "100"))
TIMEOUT = int(os.getenv("LOAD_TEST_TIMEOUT", "10"))
AUTH_TOKEN = os.getenv("LOAD_TEST_TOKEN", "")
LOG_ERRORS = os.getenv("LOAD_TEST_LOG_ERRORS", "1").strip().lower() in {"1", "true", "yes", "on"}
ERROR_SAMPLE_LIMIT = int(os.getenv("LOAD_TEST_ERROR_SAMPLE_LIMIT", "5"))


def _worker(queue: Queue, results: dict[str, int], error_samples: list[str], lock: threading.Lock) -> None:
    headers = {}
    if AUTH_TOKEN:
        headers["Authorization"] = f"Bearer {AUTH_TOKEN}"
    while True:
        item = queue.get()
        if item is None:
            queue.task_done()
            break
        try:
            resp = requests.get(f"{API_BASE}{TARGET_PATH}", headers=headers, timeout=TIMEOUT)
            code = str(resp.status_code)
            with lock:
                results[code] = results.get(code, 0) + 1
        except Exception as exc:
            error_key = type(exc).__name__
            with lock:
                results["errors"] = results.get("errors", 0) + 1
                results[error_key] = results.get(error_key, 0) + 1
                if LOG_ERRORS and len(error_samples) < ERROR_SAMPLE_LIMIT:
                    error_samples.append(f"{error_key}: {exc}")
        finally:
            queue.task_done()


def main() -> None:
    queue: Queue = Queue()
    results: dict[str, int] = {}
    error_samples: list[str] = []
    lock = threading.Lock()
    for _ in range(REQUESTS):
        queue.put(1)

    threads = []
    start = time.time()
    for _ in range(CONCURRENCY):
        t = threading.Thread(target=_worker, args=(queue, results, error_samples, lock), daemon=True)
        t.start()
        threads.append(t)

    queue.join()
    for _ in threads:
        queue.put(None)
    for t in threads:
        t.join()
    duration = max(0.001, time.time() - start)
    rps = REQUESTS / duration
    print(f"Target: {API_BASE}{TARGET_PATH}")
    print(f"Completed {REQUESTS} requests in {duration:.2f}s ({rps:.1f} rps)")
    print("Results:", results)
    if error_samples:
        print("Sample errors:")
        for err in error_samples:
            print("-", err)


if __name__ == "__main__":
    main()
