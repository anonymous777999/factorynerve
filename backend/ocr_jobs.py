"""Background OCR job queue for async processing."""

from __future__ import annotations

import logging
import os
import queue
import threading
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from backend.ledger_scan import (
    build_excel_bytes as ledger_build_excel_bytes,
    extract_data_from_image as ledger_extract_data,
    preprocess_image_bytes,
    validate_data as ledger_validate_data,
)
from backend.table_scan import build_table_excel_bytes, extract_table_from_image as table_extract_table_from_image
from backend.database import SessionLocal
from backend.models.report import AuditLog
from backend.services.ops_alerts import record_ocr_failure
from backend.utils import PROJECT_ROOT


logger = logging.getLogger(__name__)

JOB_DIR = PROJECT_ROOT / "exports" / "ocr_jobs"
MAX_QUEUE = int(os.getenv("OCR_MAX_QUEUE", "20"))
MAX_WORKERS = int(os.getenv("OCR_MAX_WORKERS", "2"))
OCR_JOB_MAX_ATTEMPTS = int(os.getenv("OCR_JOB_MAX_ATTEMPTS", "3"))
OCR_JOB_RETRY_BACKOFF_SECONDS = float(os.getenv("OCR_JOB_RETRY_BACKOFF_SECONDS", "2"))


@dataclass
class OcrJob:
    job_id: str
    kind: str
    status: str = "queued"
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)
    attempts: int = 0
    max_attempts: int = OCR_JOB_MAX_ATTEMPTS
    error: str | None = None
    input_path: str | None = None
    result_path: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)
    params: dict[str, Any] = field(default_factory=dict)


_jobs: dict[str, OcrJob] = {}
_jobs_lock = threading.Lock()
_queue: queue.Queue[str] = queue.Queue(maxsize=MAX_QUEUE)
_workers_started = False


def _ensure_dirs() -> None:
    JOB_DIR.mkdir(parents=True, exist_ok=True)


def _save_bytes(path: Path, data: bytes) -> None:
    path.write_bytes(data)


def _load_bytes(path: Path) -> bytes:
    return path.read_bytes()


def _update_job(job_id: str, **updates: Any) -> None:
    with _jobs_lock:
        job = _jobs.get(job_id)
        if not job:
            return
        for key, value in updates.items():
            setattr(job, key, value)
        job.updated_at = time.time()


def _schedule_retry(job_id: str, delay_seconds: float) -> None:
    def _requeue() -> None:
        with _jobs_lock:
            job = _jobs.get(job_id)
            if not job:
                return
            job.status = "queued"
            job.updated_at = time.time()
        try:
            _queue.put_nowait(job_id)
        except queue.Full:
            _update_job(job_id, status="failed", error="OCR queue full during retry.")

    timer = threading.Timer(max(0.0, delay_seconds), _requeue)
    timer.daemon = True
    timer.start()


def _log_job_success(job: OcrJob) -> None:
    user_id = job.params.get("user_id")
    if not user_id:
        return
    org_id = job.params.get("org_id")
    factory_id = job.params.get("factory_id")
    size_bytes = job.params.get("size_bytes", 0)
    action = "OCR_LEDGER_EXCEL_ASYNC" if job.kind == "ledger" else "OCR_TABLE_EXCEL_ASYNC"
    details = f"{action} completed size_bytes={size_bytes}"
    with SessionLocal() as db:
        db.add(
            AuditLog(
                user_id=int(user_id),
                org_id=org_id,
                factory_id=factory_id,
                action=action,
                details=details,
                ip_address=None,
                timestamp=datetime.now(timezone.utc),
            )
        )
        db.commit()


def _process_ledger(job: OcrJob) -> None:
    params = job.params
    image_bytes = _load_bytes(Path(job.input_path)) if job.input_path else b""
    base64_image = preprocess_image_bytes(image_bytes, profile=params.get("preprocess_profile"))
    rows, model_meta = ledger_extract_data(
        base64_image,
        force_mock=bool(params.get("mock")),
        system_prompt=params.get("system_prompt"),
        user_message=params.get("user_message"),
    )
    validated = ledger_validate_data(rows)
    excel_bytes = ledger_build_excel_bytes(validated)
    metadata = dict(validated.get("metadata", {}))
    metadata.update(model_meta) # Merge model tracking info
    
    result_path = JOB_DIR / f"{job.job_id}.xlsx"
    _save_bytes(result_path, excel_bytes)
    job.metadata = metadata
    job.result_path = str(result_path)
    _log_job_success(job)


def _process_table(job: OcrJob) -> None:
    params = job.params
    image_bytes = _load_bytes(Path(job.input_path)) if job.input_path else b""
    table = table_extract_table_from_image(
        image_bytes,
        system_prompt=params.get("system_prompt"),
        user_message=params.get("user_message"),
        preprocess_profile=params.get("preprocess_profile"),
    )
    excel_bytes = build_table_excel_bytes(table)
    metadata = {
        "total_rows": len(table.get("rows", [])),
        "total_columns": len(table.get("headers", [])),
    }
    result_path = JOB_DIR / f"{job.job_id}.xlsx"
    _save_bytes(result_path, excel_bytes)
    job.metadata = metadata
    job.result_path = str(result_path)
    _log_job_success(job)


def _worker_loop() -> None:
    while True:
        job_id = _queue.get()
        if job_id is None:
            break
        with _jobs_lock:
            job = _jobs.get(job_id)
        if not job:
            _queue.task_done()
            continue
        _update_job(job_id, status="running", error=None, attempts=job.attempts + 1)
        try:
            if job.kind == "ledger":
                _process_ledger(job)
            elif job.kind == "table":
                _process_table(job)
            else:
                raise RuntimeError(f"Unknown job kind: {job.kind}")
            _update_job(job_id, status="completed")
        except Exception as error:  # pylint: disable=broad-except
            logger.exception("OCR job failed: %s", job_id)
            if job.attempts < job.max_attempts:
                delay = OCR_JOB_RETRY_BACKOFF_SECONDS * (2 ** max(0, job.attempts - 1))
                _update_job(job_id, status="retrying", error=str(error))
                _schedule_retry(job_id, delay)
            else:
                _update_job(job_id, status="failed", error=str(error))
                record_ocr_failure(
                    job_id,
                    str(error),
                    org_id=str(job.params.get("org_id") or "") or None,
                    attempts=job.attempts,
                    max_attempts=job.max_attempts,
                )
        finally:
            _queue.task_done()


def start_workers() -> None:
    global _workers_started
    if _workers_started:
        return
    _ensure_dirs()
    for idx in range(max(1, MAX_WORKERS)):
        thread = threading.Thread(target=_worker_loop, name=f"ocr-worker-{idx+1}", daemon=True)
        thread.start()
    _workers_started = True
    logger.info("OCR job workers started: %s", MAX_WORKERS)


def enqueue_job(kind: str, image_bytes: bytes, params: dict[str, Any]) -> OcrJob:
    _ensure_dirs()
    job_id = uuid.uuid4().hex
    input_path = JOB_DIR / f"{job_id}.bin"
    _save_bytes(input_path, image_bytes)
    job = OcrJob(job_id=job_id, kind=kind, input_path=str(input_path), params=params)
    with _jobs_lock:
        _jobs[job_id] = job
    try:
        _queue.put_nowait(job_id)
    except queue.Full as error:
        with _jobs_lock:
            _jobs.pop(job_id, None)
        raise RuntimeError("OCR queue is full. Please retry later.") from error
    return job


def get_job(job_id: str) -> OcrJob | None:
    with _jobs_lock:
        return _jobs.get(job_id)


def get_job_payload(job_id: str) -> dict[str, Any] | None:
    job = get_job(job_id)
    if not job:
        return None
    return {
        "job_id": job.job_id,
        "kind": job.kind,
        "status": job.status,
        "created_at": job.created_at,
        "updated_at": job.updated_at,
        "attempts": job.attempts,
        "max_attempts": job.max_attempts,
        "error": job.error,
        "metadata": job.metadata,
    }
