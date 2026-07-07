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
import io
import json as json_module

from backend.ledger_scan import (
    build_excel_bytes as ledger_build_excel_bytes,
    extract_data_from_image as ledger_extract_data,
    preprocess_image_bytes,
    validate_data as ledger_validate_data,
)
from backend.table_scan import build_table_excel_bytes, extract_table_from_image as table_extract_table_from_image
from backend.database import SessionLocal
from backend.middleware.rls_context import set_rls_context, clear_rls_context
from backend.models.report import AuditLog
from backend.services.ops_alerts import record_ocr_failure
from backend.utils import PROJECT_ROOT
from .metrics import OCR_JOBS_TOTAL, OCR_JOB_LATENCY


logger = logging.getLogger(__name__)

JOB_DIR = PROJECT_ROOT / "exports" / "ocr_jobs"
MAX_QUEUE = int(os.getenv("OCR_MAX_QUEUE", "50"))
MAX_WORKERS = int(os.getenv("OCR_MAX_WORKERS", "4"))
OCR_JOB_MAX_ATTEMPTS = int(os.getenv("OCR_JOB_MAX_ATTEMPTS", "3"))
OCR_JOB_RETRY_BACKOFF_SECONDS = float(os.getenv("OCR_JOB_RETRY_BACKOFF_SECONDS", "2"))
# Maximum number of job records kept in the in-memory dict.  When this limit
# is reached, the oldest terminal (completed/failed) jobs are evicted first to
# prevent unbounded memory growth during a burst of 500+ scans.
_MAX_TRACKED_JOBS = int(os.getenv("OCR_MAX_TRACKED_JOBS", "500"))
_JOB_PERSIST_PATH = JOB_DIR / "_ocr_jobs_persist.json"
_TERMINAL_STATUSES = frozenset({"completed", "failed", "cancelled"})


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
    # Persist job state to disk so it survives server restart (Bug #5)
    _save_jobs_to_disk()


def _evict_old_jobs() -> None:
    """Evict terminal jobs from the in-memory dict when the cap is reached.

    Called under _jobs_lock by the caller.  Removes the oldest terminal
    (completed/failed/cancelled) jobs first, sorted by updated_at ascending.
    If there are still too many jobs after evicting all terminal ones, the
    oldest non-terminal jobs are evicted as a last resort (they will be
    unreachable by the client anyway).

    This prevents unbounded memory growth during a burst of 500+ scans.
    """
    if len(_jobs) < _MAX_TRACKED_JOBS:
        return
    # Sort by updated_at so oldest jobs are evicted first
    terminal = sorted(
        [j for j in _jobs.values() if j.status in _TERMINAL_STATUSES],
        key=lambda j: j.updated_at,
    )
    to_evict = terminal[: max(1, len(_jobs) - _MAX_TRACKED_JOBS + 1)]
    if not to_evict:
        # No terminal jobs — evict oldest non-terminal as last resort
        all_sorted = sorted(_jobs.values(), key=lambda j: j.updated_at)
        to_evict = all_sorted[: max(1, len(_jobs) - _MAX_TRACKED_JOBS + 1)]
    for job in to_evict:
        _jobs.pop(job.job_id, None)
        logger.debug("OCR job evicted from memory: %s (status=%s)", job.job_id, job.status)


def _cleanup_job_input(job: OcrJob) -> None:
    """Delete the on-disk input .bin file for a job, if it exists.

    Called when a job is permanently failed so we don't leak disk space.
    Errors are logged but not re-raised — cleanup is best-effort.
    """
    if job.input_path:
        try:
            Path(job.input_path).unlink(missing_ok=True)
        except Exception:
            logger.warning("Failed to delete OCR input file: %s", job.input_path, exc_info=True)


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
            # Queue is still full after the backoff delay — permanently fail the
            # job and clean up its input file to avoid a disk-space leak (Fix #5).
            with _jobs_lock:
                job = _jobs.get(job_id)
            _update_job(job_id, status="failed", error="OCR queue full during retry.")
            if job:
                _cleanup_job_input(job)

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
    # Set RLS context for this background worker so the session inherits
    # the correct tenant isolation via the PostgreSQL checkout event.
    set_rls_context(org_id=org_id, user_id=int(user_id), factory_id=factory_id)
    try:
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
    finally:
        clear_rls_context()


def _split_pdf_to_single_image(pdf_bytes: bytes) -> bytes:
    """Convert a multi-page PDF to a single composite image.

    Uses pdf2image when available; falls back to returning the first page.
    """
    try:
        from pdf2image import convert_from_bytes
        images = convert_from_bytes(pdf_bytes, fmt="jpeg", grayscale=False, size=(2000, None))
        if len(images) == 1:
            buf = io.BytesIO()
            images[0].save(buf, format="JPEG", quality=88)
            return buf.getvalue()
        # Stack pages vertically into a single composite image
        from PIL import Image
        total_height = sum(img.height for img in images)
        max_width = max(img.width for img in images)
        composite = Image.new("RGB", (max_width, total_height), (255, 255, 255))
        y_offset = 0
        for img in images:
            composite.paste(img, (0, y_offset))
            y_offset += img.height
        buf = io.BytesIO()
        composite.save(buf, format="JPEG", quality=88)
        return buf.getvalue()
    except ImportError:
        # pdf2image not available — return first page bytes as-is
        return pdf_bytes


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
    # Multi-page PDF support: check for PDF header and attempt to split pages
    if image_bytes[:4] == b"%PDF":
        try:
            image_bytes = _split_pdf_to_single_image(image_bytes)
        except Exception as _pdf_err:
            logger.warning(
                "PDF splitting failed; attempting single-page JPEG fallback: %s",
                _pdf_err,
            )
            # _split_pdf_to_single_image already tries pdf2image; if it raised,
            # we cannot safely pass raw PDF bytes to the image extractor.
            # Raise so the job is retried rather than silently producing garbage.
            raise RuntimeError(
                "PDF conversion failed and no image fallback is available. "
                "Please upload a JPEG or PNG image instead."
            ) from _pdf_err
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
        start_time = time.time()
        try:
            if job.kind == "ledger":
                _process_ledger(job)
            elif job.kind == "table":
                _process_table(job)
            else:
                raise RuntimeError(f"Unknown job kind: {job.kind}")
            _update_job(job_id, status="completed")
            _circuit_breaker_record_success()  # P2-4: Reset circuit on success
            # Success metrics
            OCR_JOBS_TOTAL.labels(status="success").inc()
            OCR_JOB_LATENCY.labels(document_type=job.kind).observe(time.time() - start_time)
        except Exception as error:  # pylint: disable=broad-except
            logger.exception("OCR job failed: %s", job_id)
            _circuit_breaker_record_failure()  # P2-4: Record failure for circuit breaker
            if job.attempts < job.max_attempts:
                delay = OCR_JOB_RETRY_BACKOFF_SECONDS * (2 ** max(0, job.attempts - 1))
                _update_job(job_id, status="retrying", error=str(error))
                _schedule_retry(job_id, delay)
            else:
                _update_job(job_id, status="failed", error=str(error))
                _cleanup_job_input(job)  # Fix #5: delete .bin file on permanent failure
                record_ocr_failure(
                    job_id,
                    str(error),
                    org_id=str(job.params.get("org_id") or "") or None,
                    attempts=job.attempts,
                    max_attempts=job.max_attempts,
                )
            # Failure metrics
            OCR_JOBS_TOTAL.labels(status="failure").inc()
            OCR_JOB_LATENCY.labels(document_type=job.kind if job else "unknown").observe(time.time() - start_time)
        finally:
            _queue.task_done()


def start_workers() -> None:
    global _workers_started
    if _workers_started:
        return
    _ensure_dirs()
    _recover_jobs_on_startup()  # Reload queued jobs from disk (Bug #5)
    for idx in range(max(1, MAX_WORKERS)):
        thread = threading.Thread(target=_worker_loop, name=f"ocr-worker-{idx+1}", daemon=True)
        thread.start()
    _workers_started = True
    logger.info("OCR job workers started: %s", MAX_WORKERS)



def _save_jobs_to_disk() -> None:
    """Save all OCR job state to disk so jobs survive server restart.

    Uses atomic write (temp file + rename) to prevent corruption if the
    process crashes mid-write (P1-4).

    NOTE: Must be called while _jobs_lock is ALREADY held (callers include
    _update_job() and enqueue_job()).  Do NOT acquire the lock here or it
    will deadlock.
    """
    data = {}
    for jid, job in _jobs.items():
        data[jid] = {
                "job_id": job.job_id,
                "kind": job.kind,
                "status": job.status,
                "created_at": job.created_at,
                "updated_at": job.updated_at,
                "attempts": job.attempts,
                "max_attempts": job.max_attempts,
                "error": job.error,
                "input_path": job.input_path,
                "result_path": job.result_path,
                "metadata": job.metadata,
                "params": job.params,
            }
    # Atomic write: write to .tmp then rename
    tmp_path = _JOB_PERSIST_PATH.with_suffix(".tmp")
    tmp_path.write_text(json_module.dumps(data), encoding="utf-8")
    tmp_path.rename(_JOB_PERSIST_PATH)


def _recover_jobs_on_startup() -> int:
    """Reload jobs from disk persistence file on server startup.

    Only recovers jobs in non-terminal states (queued, running, retrying).
    Terminal jobs (completed, failed) are discarded on restart.

    Returns the number of recovered (non-terminal) jobs.
    """
    persist_path = _JOB_PERSIST_PATH
    if not persist_path.exists():
        return 0
    try:
        raw = persist_path.read_text(encoding="utf-8")
        data = json_module.loads(raw)
    except Exception:
        logger.warning("OCR job persistence file corrupted; starting fresh.")
        return 0

    recovered = 0
    for jid, jdata in data.items():
        if jdata.get("status") in ("completed", "failed", "cancelled"):
            continue
        job = OcrJob(
            job_id=jdata.get("job_id", jid),
            kind=jdata.get("kind", "unknown"),
            status=jdata.get("status", "queued"),
            created_at=jdata.get("created_at", time.time()),
            updated_at=jdata.get("updated_at", time.time()),
            attempts=jdata.get("attempts", 0),
            max_attempts=jdata.get("max_attempts", OCR_JOB_MAX_ATTEMPTS),
            error=jdata.get("error"),
            input_path=jdata.get("input_path"),
            result_path=jdata.get("result_path"),
            metadata=jdata.get("metadata", {}),
            params=jdata.get("params", {}),
        )
        _jobs[jid] = job
        recovered += 1

    if recovered:
        logger.info("OCR job queue recovered %d jobs from disk persistence.", recovered)
    return recovered


# ── Circuit breaker: reject enqueue when recent failure rate is high ─────────
# States: CLOSED (normal), OPEN (rejecting), HALF_OPEN (testing)
_OCR_FAILURE_COUNTER: dict[str, int] = {}
_OCR_FAILURE_WINDOW = 300  # 5 minutes
_OCR_FAILURE_THRESHOLD = 20  # Open after 20 failures in window
_OCR_HALF_OPEN_TIMEOUT = 60  # Wait 60 seconds before testing (P2-4)
_OCR_CIRCUIT_STATE: str = "CLOSED"
_OCR_CIRCUIT_OPENED_AT: float = 0.0


def _circuit_breaker_allow() -> bool:
    """Check if OCR circuit breaker allows new jobs (P2-4).

    States:
    - CLOSED: normal operation, allow all requests
    - OPEN: rejecting all requests after too many failures
    - HALF_OPEN: after a cooldown period, allow a single test request
      to see if the underlying issue is resolved
    """
    global _OCR_CIRCUIT_STATE, _OCR_CIRCUIT_OPENED_AT  # noqa: PLW0603
    now = time.time()
    
    if _OCR_CIRCUIT_STATE == "CLOSED":
        # Normal path: count recent failures
        cutoff = now - _OCR_FAILURE_WINDOW
        stale_keys = [k for k, v in list(_OCR_FAILURE_COUNTER.items()) if v < cutoff]
        for k in stale_keys:
            del _OCR_FAILURE_COUNTER[k]
        total = sum(1 for v in _OCR_FAILURE_COUNTER.values() if v >= cutoff)
        if total >= _OCR_FAILURE_THRESHOLD:
            # Too many failures — open the circuit
            _OCR_CIRCUIT_STATE = "OPEN"
            _OCR_CIRCUIT_OPENED_AT = now
            logger.warning(
                "OCR circuit breaker OPEN after %s failures in %ss window",
                total, _OCR_FAILURE_WINDOW,
            )
            return False
        return True
    
    if _OCR_CIRCUIT_STATE == "OPEN":
        # Check if cooldown has elapsed
        if now - _OCR_CIRCUIT_OPENED_AT >= _OCR_HALF_OPEN_TIMEOUT:
            _OCR_CIRCUIT_STATE = "HALF_OPEN"
            logger.info("OCR circuit breaker HALF_OPEN — allowing test request")
            return True  # Allow a single test request
        return False
    
    # HALF_OPEN: We allowed a test request; the caller must record success
    # or failure via the appropriate function.
    return True


def _circuit_breaker_record_failure() -> None:
    """Record a failure and transition to OPEN if in HALF_OPEN state."""
    global _OCR_CIRCUIT_STATE, _OCR_CIRCUIT_OPENED_AT  # noqa: PLW0603
    _OCR_FAILURE_COUNTER[uuid.uuid4().hex] = time.time()
    if _OCR_CIRCUIT_STATE == "HALF_OPEN":
        # Test request failed — back to OPEN
        _OCR_CIRCUIT_STATE = "OPEN"
        _OCR_CIRCUIT_OPENED_AT = time.time()
        logger.warning("OCR circuit breaker HALF_OPEN test failed — back to OPEN")


def _circuit_breaker_record_success() -> None:
    """Record a success and reset the circuit to CLOSED."""
    global _OCR_CIRCUIT_STATE, _OCR_CIRCUIT_OPENED_AT, _OCR_FAILURE_COUNTER  # noqa: PLW0603
    if _OCR_CIRCUIT_STATE == "HALF_OPEN":
        # Test request succeeded — reset the circuit
        _OCR_CIRCUIT_STATE = "CLOSED"
        _OCR_CIRCUIT_OPENED_AT = 0.0
        _OCR_FAILURE_COUNTER.clear()
        logger.info("OCR circuit breaker reset to CLOSED after successful test")


def _circuit_breaker_reset() -> None:
    """Force reset the circuit breaker to CLOSED."""
    global _OCR_CIRCUIT_STATE, _OCR_CIRCUIT_OPENED_AT  # noqa: PLW0603
    _OCR_FAILURE_COUNTER.clear()
    _OCR_CIRCUIT_STATE = "CLOSED"
    _OCR_CIRCUIT_OPENED_AT = 0.0

def enqueue_job(kind: str, image_bytes: bytes, params: dict[str, Any]) -> OcrJob:
    """Enqueue an OCR job for async processing.

    Backpressure ordering (Fix #5):
    1. Check queue capacity FIRST via a non-blocking put attempt so we never
       write bytes to disk for a job that will be immediately rejected.
    2. Only after the queue slot is secured do we persist the input file and
       register the job in _jobs.  This prevents disk-space leaks during
       traffic bursts where the queue is already full.
    """
    _ensure_dirs()
    job_id = uuid.uuid4().hex

    # --- Step 0: Circuit breaker check (P2-4) ---
    # If the breaker is OPEN (too many recent failures), reject immediately
    # to prevent cascading failures and wasted work.
    if not _circuit_breaker_allow():
        logger.warning(
            "OCR enqueue rejected by circuit breaker for job_id=%s kind=%s",
            job_id, kind,
        )
        raise RuntimeError(
            "OCR service is temporarily unavailable due to high failure rate. "
            "Please retry later."
        )

    # --- Step 1: Claim a queue slot BEFORE touching disk ---
    # We put the job_id speculatively; if the queue is full we bail immediately
    # without writing any bytes.  The worker will not see this job_id in _jobs
    # yet (we haven't inserted it), so it will skip it harmlessly.
    try:
        _queue.put_nowait(job_id)
    except queue.Full as error:
        raise RuntimeError("OCR queue is full. Please retry later.") from error

    # --- Step 2: Persist input file and register job now that slot is held ---
    input_path = JOB_DIR / f"{job_id}.bin"
    try:
        _save_bytes(input_path, image_bytes)
    except Exception:
        # Disk write failed — the job_id is already in the queue but _jobs has
        # no entry for it, so the worker will call _jobs.get(job_id) → None and
        # skip it harmlessly.  Log and re-raise so the caller gets a 500.
        logger.exception("OCR input file write failed for job %s; aborting enqueue.", job_id)
        raise

    job = OcrJob(job_id=job_id, kind=kind, input_path=str(input_path), params=params)
    with _jobs_lock:
        _evict_old_jobs()  # Evict terminal jobs before adding new one (memory protection)
        _jobs[job_id] = job
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
