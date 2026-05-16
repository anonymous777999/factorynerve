"""Asynchronous dispatch worker for ops alerts."""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
import logging
import queue
import threading
import time

from backend.database import SessionLocal
from backend.models.ops_alert_event import OpsAlertEvent
from backend.services.ops_alerts.formatter import format_alert_message
from backend.services.ops_alerts.recipients import AlertDeliveryTarget, format_whatsapp_target, resolve_alert_delivery_targets
from backend.services.ops_alerts.types import AlertCandidate, AlertDispatchResult
from backend.services import whatsapp_sender


logger = logging.getLogger(__name__)


class AlertDispatcher:
    def __init__(
        self,
        *,
        provider_name: str,
        app_name: str,
        env_name: str,
        timezone_name: str,
        worker_count: int,
        queue_size: int = 256,
    ) -> None:
        self._provider_name = provider_name
        self._app_name = app_name
        self._env_name = env_name
        self._timezone_name = timezone_name
        self._worker_count = max(1, worker_count)
        self._queue: queue.Queue[AlertCandidate | None] = queue.Queue(maxsize=max(8, queue_size))
        self._threads: list[threading.Thread] = []
        self._started = False
        self._accepting = False
        self._delivery_batch_size = min(8, max(2, self._worker_count * 2))

    @property
    def provider_name(self) -> str:
        return self._provider_name

    def _mask_phone_number(self, value: str | None) -> str:
        digits = "".join(char for char in str(value or "") if char.isdigit())
        if len(digits) >= 4:
            return f"***{digits[-4:]}"
        return "***"

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
            self.record_queued(candidate)
            return True
        except queue.Full:
            logger.warning("Ops alert queue is full. Dropping alert %s.", candidate.ref_id or candidate.dedup_key)
            return False

    def record_queued(self, candidate: AlertCandidate) -> None:
        self._persist_result(
            candidate=candidate,
            recipient_phone=None,
            status="queued",
            delivery_status="queued",
            attempt_count=0,
            last_error=None,
            dispatched=False,
        )

    def record_drop(self, candidate: AlertCandidate, *, reason: str) -> None:
        self._persist_result(
            candidate=candidate,
            recipient_phone=None,
            status="failed",
            delivery_status=f"dropped_{reason}",
            attempt_count=0,
            last_error=reason,
            dispatched=False,
        )

    def record_suppressed(self, candidate: AlertCandidate, *, reason: str) -> None:
        self._persist_result(
            candidate=candidate,
            recipient_phone=None,
            status="suppressed",
            delivery_status="suppressed",
            attempt_count=0,
            last_error=reason,
            dispatched=False,
            suppressed_reason=reason,
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
                self._persist_result(
                    candidate=candidate,
                    recipient_phone=None,
                    status="failed",
                    delivery_status="failed",
                    attempt_count=0,
                    last_error="dispatcher_crash",
                    dispatched=False,
                )
            finally:
                self._queue.task_done()

    def _persist_result(
        self,
        *,
        candidate: AlertCandidate,
        recipient_phone: str | None,
        status: str,
        delivery_status: str,
        attempt_count: int,
        last_error: str | None,
        dispatched: bool,
        suppressed_reason: str | None = None,
        provider_response: dict | None = None,
        provider_message_id: str | None = None,
    ) -> None:
        try:
            with SessionLocal() as db:
                query = db.query(OpsAlertEvent).filter(OpsAlertEvent.ref_id == str(candidate.ref_id or ""))
                if recipient_phone is None:
                    query = query.filter(OpsAlertEvent.recipient_phone.is_(None))
                else:
                    query = query.filter(OpsAlertEvent.recipient_phone == recipient_phone)
                row = query.first()
                if row is None:
                    row_meta = candidate.storage_meta if candidate.storage_meta is not None else candidate.meta
                    if provider_response is not None or provider_message_id is not None:
                        row_meta = dict(row_meta or {})
                        row_meta["dispatch"] = {
                            "provider_response": provider_response,
                            "provider_message_id": provider_message_id,
                        }
                    row = OpsAlertEvent(
                        ref_id=str(candidate.ref_id or ""),
                        org_id=candidate.org_id,
                        org_name=candidate.org_name,
                        event_type=candidate.event_type.value,
                        severity=candidate.severity.value,
                        status=status,
                        dedup_key=candidate.dedup_key,
                        group_key=candidate.group_key,
                        escalation_level=candidate.escalation_level,
                        is_summary=candidate.is_summary,
                        summary=candidate.summary,
                        recipient_phone=recipient_phone,
                        meta=row_meta,
                        provider=self.provider_name,
                        delivery_status=delivery_status,
                        suppressed_reason=suppressed_reason,
                        attempt_count=attempt_count,
                        last_error=last_error,
                        created_at=candidate.timestamp,
                    )
                    db.add(row)
                else:
                    row.org_id = candidate.org_id
                    row.org_name = candidate.org_name
                    row.severity = candidate.severity.value
                    row.status = status
                    row.group_key = candidate.group_key
                    row.escalation_level = candidate.escalation_level
                    row.is_summary = candidate.is_summary
                    row.summary = candidate.summary
                    row.delivery_status = delivery_status
                    row.suppressed_reason = suppressed_reason
                    row.attempt_count = attempt_count
                    row.last_error = last_error
                    row.provider = self.provider_name
                    row_meta = candidate.storage_meta if candidate.storage_meta is not None else candidate.meta
                    if provider_response is not None or provider_message_id is not None:
                        row_meta = dict(row_meta or {})
                        row_meta["dispatch"] = {
                            "provider_response": provider_response,
                            "provider_message_id": provider_message_id,
                        }
                    row.meta = row_meta
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
        targets = self._resolve_targets(candidate)
        if not targets:
            logger.warning("No active ops alert recipients available for %s.", candidate.ref_id)
            self._persist_result(
                candidate=candidate,
                recipient_phone=None,
                status="suppressed",
                delivery_status="suppressed",
                attempt_count=0,
                last_error="no_matching_recipients",
                dispatched=False,
                suppressed_reason="no_matching_recipients",
            )
            return
        results: list[AlertDispatchResult] = []
        max_workers = min(self._delivery_batch_size, len(targets))
        if max_workers <= 1:
            for target in targets:
                results.append(self._deliver_to_target(candidate, message, target))
        else:
            with ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix="ops-alert-recipient") as executor:
                futures = [executor.submit(self._deliver_to_target, candidate, message, target) for target in targets]
                for future in as_completed(futures):
                    try:
                        results.append(future.result())
                    except Exception:  # pylint: disable=broad-except
                        logger.exception("Ops alert recipient worker crashed for %s.", candidate.ref_id)
                        results.append(
                            AlertDispatchResult(
                                success=False,
                                provider=self.provider_name,
                                result_status="failed",
                                retryable=False,
                                error="recipient_worker_crash",
                            )
                        )
        delivered_count = sum(1 for result in results if result.success)
        suppressed_count = sum(1 for result in results if result.result_status in {"suppressed", "disabled"})
        max_attempt_count = max((result.attempt_count for result in results), default=0)
        if delivered_count == len(results):
            status = "sent"
            delivery_status = "dispatched"
        elif delivered_count > 0:
            status = "sent"
            delivery_status = "partial_failure"
        elif suppressed_count == len(results) and results:
            status = "suppressed"
            delivery_status = "suppressed"
        else:
            status = "failed"
            delivery_status = "failed"
        self._persist_result(
            candidate=candidate,
            recipient_phone=None,
            status=status,
            delivery_status=delivery_status,
            attempt_count=max_attempt_count,
            last_error=(
                None
                if delivered_count > 0
                else ("all_recipients_suppressed" if suppressed_count == len(results) and results else "all_recipients_failed")
            ),
            dispatched=delivered_count > 0,
        )

    def _resolve_targets(self, candidate: AlertCandidate) -> list[AlertDeliveryTarget]:
        if candidate.to_number:
            try:
                target = format_whatsapp_target(candidate.to_number)
            except ValueError:
                return []
            return [AlertDeliveryTarget(recipient_id=0, phone_number=target, receive_daily_summary=True)]
        try:
            with SessionLocal() as db:
                return resolve_alert_delivery_targets(db, org_id=candidate.org_id, candidate=candidate)
        except Exception:  # pylint: disable=broad-except
            logger.exception("Failed to load ops alert recipients for %s.", candidate.ref_id)
            return []

    def _deliver_to_target(
        self,
        candidate: AlertCandidate,
        message: str,
        target: AlertDeliveryTarget,
    ) -> AlertDispatchResult:
        self._persist_result(
            candidate=candidate,
            recipient_phone=target.phone_number,
            status="queued",
            delivery_status="queued",
            attempt_count=0,
            last_error=None,
            dispatched=False,
        )
        try:
            message_result = whatsapp_sender.send_message_blocking(
                to=target.phone_number,
                template_name="ops_alert_text",
                template_params={"body": message},
                org_id=candidate.org_id,
            )
        except Exception as error:  # pylint: disable=broad-except
            logger.exception("Ops alert sender crashed for %s.", candidate.ref_id)
            message_result = whatsapp_sender.MessageResult(
                provider_message_id=None,
                status="failed",
                provider_response={"provider": self.provider_name, "reason": "sender_crash"},
                error_message=str(error),
                attempt_count=0,
            )
        success = message_result.status == "sent"
        if message_result.status == "sent":
            event_status = "sent"
            delivery_status = "dispatched"
        elif message_result.status in {"suppressed", "disabled"}:
            event_status = "suppressed"
            delivery_status = "suppressed"
        else:
            event_status = "failed"
            delivery_status = "failed"
        self._persist_result(
            candidate=candidate,
            recipient_phone=target.phone_number,
            status=event_status,
            delivery_status=delivery_status,
            attempt_count=message_result.attempt_count,
            last_error=message_result.error_message,
            dispatched=success,
            provider_response=message_result.provider_response,
            provider_message_id=message_result.provider_message_id,
        )
        if not success:
            logger.warning(
                "ops_alert_delivery_failed ref_id=%s provider=%s recipient=%s error=%s",
                candidate.ref_id,
                self.provider_name,
                self._mask_phone_number(target.phone_number),
                message_result.error_message or "unknown_error",
            )
        return AlertDispatchResult(
            success=success,
            provider=self.provider_name,
            result_status=message_result.status,
            retryable=False,
            error=message_result.error_message,
            external_id=message_result.provider_message_id,
            attempt_count=message_result.attempt_count,
        )
