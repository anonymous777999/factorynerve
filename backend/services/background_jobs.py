"""Background job registry with optional Redis-backed shared state."""

from __future__ import annotations

from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import datetime, timezone
import json
import logging
import os
from pathlib import Path
import threading
import uuid
from typing import Any

from backend.cache import get_redis_client, json_default


logger = logging.getLogger(__name__)

ROOT_DIR = Path(__file__).resolve().parents[2]
JOBS_DIR = ROOT_DIR / "exports" / "background_jobs"
JOB_TTL_SECONDS = int(os.getenv("BACKGROUND_JOB_TTL_SECONDS", str(60 * 60 * 24)))
JOB_HISTORY_LIMIT = int(os.getenv("BACKGROUND_JOB_HISTORY_LIMIT", "25"))

ACTIVE_STATUSES = {"queued", "running", "canceling"}
TERMINAL_STATUSES = {"succeeded", "failed", "canceled"}

ProgressUpdater = Callable[[int, str | None], None]
RetryHandler = Callable[[dict[str, Any], dict[str, Any]], dict[str, Any]]

_lock = threading.Lock()
_jobs: dict[str, "JobRecord"] = {}
_executor = ThreadPoolExecutor(max_workers=int(os.getenv("BACKGROUND_JOB_WORKERS", "4")))
_retry_handlers: dict[str, RetryHandler] = {}


class JobCancelledError(RuntimeError):
    """Raised when a running job is canceled mid-flight."""


@dataclass
class JobRecord:
    job_id: str
    kind: str
    owner_id: int
    org_id: str | None
    status: str
    progress: int
    message: str
    created_at: datetime
    updated_at: datetime
    context: dict[str, Any] | None = None
    result: dict[str, Any] | None = None
    error: str | None = None
    cancel_requested: bool = False
    retry_context: dict[str, Any] | None = None


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _redis_job_key(job_id: str) -> str:
    return f"jobs:{job_id}"


def _redis_user_jobs_key(owner_id: int) -> str:
    return f"jobs:user:{owner_id}"


def _can_cancel(record: JobRecord) -> bool:
    return record.status in ACTIVE_STATUSES


def _can_retry(record: JobRecord) -> bool:
    return (
        record.status in {"failed", "canceled"}
        and record.retry_context is not None
        and record.kind in _retry_handlers
    )


def _serialize_job(record: JobRecord) -> dict[str, Any]:
    return {
        "job_id": record.job_id,
        "kind": record.kind,
        "owner_id": record.owner_id,
        "org_id": record.org_id,
        "status": record.status,
        "progress": record.progress,
        "message": record.message,
        "created_at": record.created_at.isoformat(),
        "updated_at": record.updated_at.isoformat(),
        "context": record.context,
        "result": record.result,
        "error": record.error,
        "cancel_requested": record.cancel_requested,
        "can_cancel": _can_cancel(record),
        "can_retry": _can_retry(record),
    }


def _deserialize_job(payload: dict[str, Any]) -> JobRecord:
    return JobRecord(
        job_id=str(payload["job_id"]),
        kind=str(payload["kind"]),
        owner_id=int(payload["owner_id"]),
        org_id=str(payload["org_id"]) if payload.get("org_id") is not None else None,
        status=str(payload["status"]),
        progress=int(payload["progress"]),
        message=str(payload["message"]),
        created_at=datetime.fromisoformat(str(payload["created_at"])),
        updated_at=datetime.fromisoformat(str(payload["updated_at"])),
        context=payload.get("context"),
        result=payload.get("result"),
        error=str(payload["error"]) if payload.get("error") is not None else None,
        cancel_requested=bool(payload.get("cancel_requested")),
        retry_context=payload.get("retry_context"),
    )


def _persist_record(record: JobRecord) -> None:
    client = get_redis_client()
    if client is None:
        return
    try:  # pragma: no cover - depends on Redis runtime
        payload = json.dumps(
            {
                **_serialize_job(record),
                "retry_context": record.retry_context,
            },
            default=json_default,
        )
        pipe = client.pipeline()
        pipe.setex(_redis_job_key(record.job_id), JOB_TTL_SECONDS, payload)
        pipe.zadd(
            _redis_user_jobs_key(record.owner_id),
            {record.job_id: record.updated_at.timestamp()},
        )
        pipe.expire(_redis_user_jobs_key(record.owner_id), JOB_TTL_SECONDS)
        if JOB_HISTORY_LIMIT > 0:
            pipe.zremrangebyrank(_redis_user_jobs_key(record.owner_id), 0, -(JOB_HISTORY_LIMIT + 1))
        pipe.execute()
    except Exception:
        logger.warning("Could not persist job %s to Redis.", record.job_id)


def _load_from_redis(job_id: str) -> JobRecord | None:
    client = get_redis_client()
    if client is None:
        return None
    try:  # pragma: no cover - depends on Redis runtime
        raw = client.get(_redis_job_key(job_id))
        if not raw:
            return None
        return _deserialize_job(json.loads(raw))
    except Exception:
        logger.warning("Could not load job %s from Redis.", job_id)
        return None


def _store_local(record: JobRecord) -> JobRecord:
    with _lock:
        _jobs[record.job_id] = record
        return record


def _get_record(job_id: str) -> JobRecord | None:
    with _lock:
        record = _jobs.get(job_id)
    if record is None:
        record = _load_from_redis(job_id)
        if record is not None:
            _store_local(record)
    return record


def _require_owned_record(job_id: str, owner_id: int | None = None) -> JobRecord:
    record = _get_record(job_id)
    if record is None:
        raise KeyError(job_id)
    if owner_id is not None and record.owner_id != owner_id:
        raise PermissionError("Access denied for this job.")
    return record


def _is_cancel_requested(job_id: str) -> bool:
    record = _get_record(job_id)
    if record is None:
        return False
    return bool(record.cancel_requested or record.status in {"canceling", "canceled"})


def _raise_if_cancel_requested(job_id: str) -> None:
    if _is_cancel_requested(job_id):
        raise JobCancelledError("Job canceled.")


def register_retry_handler(kind: str, handler: RetryHandler) -> None:
    _retry_handlers[kind] = handler


def create_job(
    *,
    kind: str,
    owner_id: int,
    org_id: str | None = None,
    message: str = "Queued",
    context: dict[str, Any] | None = None,
    retry_context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    record = JobRecord(
        job_id=uuid.uuid4().hex,
        kind=kind,
        owner_id=owner_id,
        org_id=org_id,
        status="queued",
        progress=0,
        message=message,
        created_at=_now(),
        updated_at=_now(),
        context=context,
        retry_context=retry_context,
    )
    _store_local(record)
    _persist_record(record)
    return _serialize_job(record)


def update_job(
    job_id: str,
    *,
    status: str | None = None,
    progress: int | None = None,
    message: str | None = None,
    result: dict[str, Any] | None = None,
    error: str | None = None,
    cancel_requested: bool | None = None,
    context: dict[str, Any] | None = None,
    retry_context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    record = _get_record(job_id)
    if record is None:
        raise KeyError(job_id)
    if status is not None:
        record.status = status
    if progress is not None:
        record.progress = max(0, min(100, int(progress)))
    if message is not None:
        record.message = message
    if result is not None:
        record.result = result
    if error is not None:
        record.error = error
    if cancel_requested is not None:
        record.cancel_requested = cancel_requested
    if context is not None:
        record.context = context
    if retry_context is not None:
        record.retry_context = retry_context
    record.updated_at = _now()
    _store_local(record)
    _persist_record(record)
    return _serialize_job(record)


def get_job(job_id: str, *, owner_id: int | None = None) -> dict[str, Any] | None:
    try:
        record = _require_owned_record(job_id, owner_id)
    except (KeyError, PermissionError):
        return None
    return _serialize_job(record)


def list_jobs(*, owner_id: int, limit: int = 12) -> list[dict[str, Any]]:
    client = get_redis_client()
    if client is not None:
        try:  # pragma: no cover - depends on Redis runtime
            job_ids = client.zrevrange(_redis_user_jobs_key(owner_id), 0, max(0, limit - 1))
            results: list[dict[str, Any]] = []
            for job_id in job_ids:
                payload = get_job(job_id, owner_id=owner_id)
                if payload:
                    results.append(payload)
            if results:
                return results
        except Exception:
            logger.warning("Could not list Redis jobs for user %s.", owner_id)

    with _lock:
        owned = [record for record in _jobs.values() if record.owner_id == owner_id]
    owned.sort(key=lambda record: record.updated_at, reverse=True)
    return [_serialize_job(record) for record in owned[:limit]]


def cancel_job(job_id: str, *, owner_id: int | None = None) -> dict[str, Any]:
    record = _require_owned_record(job_id, owner_id)
    if record.status in TERMINAL_STATUSES:
        raise ValueError("Only queued or running jobs can be canceled.")
    if record.status == "queued":
        return update_job(
            job_id,
            status="canceled",
            progress=100,
            message="Canceled before start",
            error=None,
            cancel_requested=True,
        )
    return update_job(
        job_id,
        status="canceling",
        message="Cancel requested",
        error=None,
        cancel_requested=True,
    )


def retry_job(job_id: str, *, owner_id: int | None = None) -> dict[str, Any]:
    record = _require_owned_record(job_id, owner_id)
    if record.status not in {"failed", "canceled"}:
        raise ValueError("Only failed or canceled jobs can be retried.")
    if record.retry_context is None:
        raise ValueError("Retry is not configured for this job.")
    handler = _retry_handlers.get(record.kind)
    if handler is None:
        raise ValueError("Retry is not available for this job kind.")
    return handler(record.retry_context, _serialize_job(record))


def mark_job_complete(job_id: str, result: dict[str, Any], *, message: str = "Complete") -> dict[str, Any]:
    return update_job(
        job_id,
        status="succeeded",
        progress=100,
        message=message,
        result=result,
        error=None,
        cancel_requested=False,
    )


def _progress_updater(job_id: str) -> ProgressUpdater:
    def update(progress: int, message: str | None = None) -> None:
        _raise_if_cancel_requested(job_id)
        update_job(job_id, status="running", progress=progress, message=message or "Working")

    return update


def start_job(job_id: str, worker: Callable[[ProgressUpdater], dict[str, Any] | None]) -> None:
    def run() -> None:
        try:
            _raise_if_cancel_requested(job_id)
            update_job(job_id, status="running", progress=5, message="Started", error=None)
            progress = _progress_updater(job_id)
            result = worker(progress) or {}
            if _is_cancel_requested(job_id):
                update_job(
                    job_id,
                    status="canceled",
                    progress=100,
                    message="Canceled",
                    error=None,
                    cancel_requested=True,
                )
                return
            mark_job_complete(job_id, result)
        except JobCancelledError:
            update_job(
                job_id,
                status="canceled",
                progress=100,
                message="Canceled",
                error=None,
                cancel_requested=True,
            )
        except Exception as error:  # pylint: disable=broad-except
            if _is_cancel_requested(job_id):
                update_job(
                    job_id,
                    status="canceled",
                    progress=100,
                    message="Canceled",
                    error=None,
                    cancel_requested=True,
                )
                return
            logger.exception("Background job failed: %s", job_id)
            update_job(
                job_id,
                status="failed",
                progress=100,
                message="Failed",
                error=str(error),
                cancel_requested=False,
            )

    _executor.submit(run)


def write_job_file(job_id: str, *, filename: str, content: bytes, media_type: str) -> dict[str, Any]:
    job_dir = JOBS_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    safe_name = Path(filename).name or f"{job_id}.bin"
    file_path = job_dir / safe_name
    file_path.write_bytes(content)
    return {
        "filename": safe_name,
        "media_type": media_type,
        "size_bytes": len(content),
        "stored_path": str(file_path),
    }


def read_job_file(job_id: str, *, owner_id: int | None = None) -> tuple[bytes, dict[str, Any]]:
    job = get_job(job_id, owner_id=owner_id)
    if not job:
        raise FileNotFoundError("Job not found.")
    result = job.get("result") or {}
    file_meta = result.get("file")
    if not isinstance(file_meta, dict):
        raise FileNotFoundError("Job file not available.")
    file_path = file_meta.get("stored_path")
    if not file_path:
        raise FileNotFoundError("Stored path missing.")
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError("Job file missing.")
    return path.read_bytes(), file_meta
