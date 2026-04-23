"""Asynchronous dispatch worker for ops alerts."""

from __future__ import annotations

from datetime import datetime, timezone
import logging
import queue
import threading
import time

from backend.database import SessionLocal
from backend.models.ops_alert_event import OpsAlertEvent
from backend.services.ops_alerts.formatter import format_alert_message
from backend.services.ops_alerts.types import AlertCandidate, AlertDispatchResult


logger = logging.getLogger(__name__)


class AlertDispatcher:
    def __init__(
        self,
        *,
        provider,
        app_name: str,
        env_name: str,
        timezone_name: str,
        worker_count: int,
        retry_attempts: int,
        retry_backoff_seconds: float,
        queue_size: int = 256,
    ) -> None:
        self._provider = provider
        self._app_name = app_name
        self._env_name = env_name
        self._timezone_name = timezone_name
        self._worker_count = max(1, worker_count)
        self._retry_attempts = max(1, retry_attempts)
        self._retry_backoff_seconds = max(0.1, retry_backoff_seconds)
        self._queue: queue.Queue[AlertCandidate | None] = queue.Queue(maxsize=max(8, queue_size))
        self._threads: list[threading.Thread] = []
        self._started = False
        self._accepting = False

    @property
    def provider_name(self) -> str:
        return getattr(self._provider, "name", "unknown")

    def start(self) -> None:
        if self._started:
            return
        self._accepting = True
        for index in range(self._worker_count):
            thread = threading.Thread(
                target=self._worker_loop,
                name=f"ops-alert-dispatcher-{index + 1}",
                daemon=True,
            )
            thread.start()
            self._threads.append(thread)
        self._started = True

    def stop(self, *, drain_timeout_seconds: float = 5.0) -> None:
        if not self._started:
            return
        self._accepting = False
        deadline = time.time() + max(0.1, drain_timeout_seconds)
        while self._queue.unfinished_tasks and time.time() < deadline:
            time.sleep(0.05)
        for _ in self._threads:
            remaining = max(0.1, deadline - time.time())
            try:
                self._queue.put(None, timeout=remaining)
            except queue.Full:
                logger.warning("Ops alert dispatcher did not drain cleanly before shutdown.")
                break
        for thread in self._threads:
            thread.join(timeout=max(0.1, deadline - time.time()))
        self._threads.clear()
        self._started = False

    def enqueue(self, candidate: AlertCandidate) -> bool:
        if not self._started or not self._accepting:
            logger.warning("Ops alert dispatcher is not accepting new work for %s.", candidate.ref_id or candidate.dedup_key)
            return False
        try:
            self._queue.put_nowait(candidate)
            return True
        except queue.Full:
            logger.warning("Ops alert queue is full. Dropping alert %s.", candidate.ref_id or candidate.dedup_key)
            return False

    def record_drop(self, candidate: AlertCandidate, *, reason: str) -> None:
        self._persist_result(
            candidate=candidate,
            delivery_status=f"dropped_{reason}",
            attempt_count=0,
            last_error=reason,
            dispatched=False,
        )

    def _worker_loop(self) -> None:
        while True:
            candidate = self._queue.get()
            if candidate is None:
                self._queue.task_done()
                break
            try:
                self._deliver_candidate(candidate)
            except Exception:  # pylint: disable=broad-except
                logger.exception("Ops alert dispatch crashed for %s.", candidate.ref_id or candidate.dedup_key)
            finally:
                self._queue.task_done()

    def _persist_result(
        self,
        *,
        candidate: AlertCandidate,
        delivery_status: str,
        attempt_count: int,
        last_error: str | None,
        dispatched: bool,
    ) -> None:
        try:
            with SessionLocal() as db:
                row = db.query(OpsAlertEvent).filter(OpsAlertEvent.ref_id == candidate.ref_id).first()
                if row is None:
                    row = OpsAlertEvent(
                        ref_id=str(candidate.ref_id or ""),
                        event_type=candidate.event_type.value,
                        severity=candidate.severity.value,
                        dedup_key=candidate.dedup_key,
                        summary=candidate.summary,
                        meta=candidate.storage_meta if candidate.storage_meta is not None else candidate.meta,
                        provider=self.provider_name,
                        delivery_status=delivery_status,
                        attempt_count=attempt_count,
                        last_error=last_error,
                        created_at=candidate.timestamp,
                    )
                    db.add(row)
                else:
                    row.delivery_status = delivery_status
                    row.attempt_count = attempt_count
                    row.last_error = last_error
                    row.provider = self.provider_name
                    row.meta = candidate.storage_meta if candidate.storage_meta is not None else candidate.meta
                if dispatched:
                    row.dispatched_at = datetime.now(timezone.utc)
                db.commit()
        except Exception:  # pylint: disable=broad-except
            logger.exception("Failed to persist ops alert %s.", candidate.ref_id)

    def _deliver_candidate(self, candidate: AlertCandidate) -> None:
        message = format_alert_message(
            candidate,
            app_name=self._app_name,
            env_name=self._env_name,
            timezone_name=self._timezone_name,
        )
        self._persist_result(
            candidate=candidate,
            delivery_status="queued",
            attempt_count=0,
            last_error=None,
            dispatched=False,
        )
        last_result = AlertDispatchResult(success=False, provider=self.provider_name, error="Delivery not attempted.")
        for attempt in range(1, self._retry_attempts + 1):
            try:
                last_result = self._provider.deliver(message, to_number=candidate.to_number)
            except Exception as error:  # pylint: disable=broad-except
                logger.exception("Ops alert provider crashed for %s.", candidate.ref_id)
                last_result = AlertDispatchResult(
                    success=False,
                    provider=self.provider_name,
                    retryable=False,
                    error=str(error),
                )
            status = "delivered" if last_result.success else ("retrying" if last_result.retryable and attempt < self._retry_attempts else "failed")
            self._persist_result(
                candidate=candidate,
                delivery_status=status,
                attempt_count=attempt,
                last_error=last_result.error,
                dispatched=last_result.success,
            )
            if last_result.success or not last_result.retryable:
                return
            time.sleep(self._retry_backoff_seconds * attempt)
        logger.warning(
            "Ops alert delivery failed ref_id=%s provider=%s error=%s",
            candidate.ref_id,
            self.provider_name,
            last_result.error,
        )
