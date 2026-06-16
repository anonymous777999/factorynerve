"""Feedback anomaly detection — implements Layer 5 (P2) of the Feedback Channel
Security Plan (docs/FEEDBACK_CHANNEL_SECURITY_PLAN.md).

Detects three anomaly patterns by scanning the AuditLog table for FEEDBACK_*
events:

    Alert A — Volume spike:      More feedback in 24h than in prior 30 days combined.
    Alert B — Repeat blocks:     2+ blocked submissions (data pattern OR rate limit)
                                 in 24h from the same user.
    Alert C — Block-then-success: A blocked submission followed by a successful one
                                 within 10 minutes from the same user (pattern probing).

Alerts are written as AuditLog entries with severity "high" or "medium".
The detection runs as a daemon thread, polling on a configurable interval.
"""

from __future__ import annotations

import logging
import os
import threading
from datetime import datetime, timedelta, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.database import SessionLocal
from backend.models.report import AuditLog

logger = logging.getLogger(__name__)

FEEDBACK_ANOMALY_POLL_SECONDS_DEFAULT = 600.0  # 10 minutes

_service_lock = threading.Lock()
_service: FeedbackAnomalyDetector | None = None


def _env_float(name: str, default: float) -> float:
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return default
    try:
        return float(raw)
    except ValueError:
        return default


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


def _write_anomaly_alert(
    db: Session,
    *,
    alert_name: str,
    severity: str,
    detail: str,
    user_id: int | None = None,
    org_id: str | None = None,
    factory_id: str | None = None,
) -> None:
    """Write an anomaly alert as an audit log entry."""
    db.add(
        AuditLog(
            user_id=user_id,
            org_id=org_id,
            factory_id=factory_id,
            action=f"FEEDBACK_ANOMALY_{alert_name}",
            details=detail,
            ip_address=None,
            timestamp=datetime.now(timezone.utc),
        )
    )


# ── Alert A: Volume Spike ─────────────────────────────────────────────────


def _detect_volume_spike(db: Session) -> int:
    """Alert A — More feedback in 24h than in prior 30 days combined.

    Compares the count of FEEDBACK_SUBMIT events per org in the last 24 hours
    against the count in the 30-day period that ended 24 hours ago.
    """
    now = datetime.now(timezone.utc)
    twenty_four_hours_ago = now - timedelta(hours=24)
    # Prior 30 days = 31 days ago to 24 hours ago (30 full days)
    thirty_one_days_ago = now - timedelta(days=31)

    alert_count = 0

    recent_rows = (
        db.query(
            AuditLog.org_id,
            func.count(AuditLog.id).label("cnt"),
        )
        .filter(
            AuditLog.action == "FEEDBACK_SUBMIT",
            AuditLog.timestamp >= twenty_four_hours_ago,
        )
        .group_by(AuditLog.org_id)
        .all()
    )

    for row in recent_rows:
        org_id = row.org_id
        recent_count = int(row.cnt)

        historical_count = (
            db.query(func.count(AuditLog.id))
            .filter(
                AuditLog.action == "FEEDBACK_SUBMIT",
                AuditLog.org_id == org_id,
                AuditLog.timestamp >= thirty_one_days_ago,
                AuditLog.timestamp < twenty_four_hours_ago,
            )
            .scalar()
            or 0
        )

        if historical_count > 0 and recent_count > historical_count:
            _write_anomaly_alert(
                db,
                alert_name="VOLUME_SPIKE",
                severity="high",
                org_id=org_id,
                detail=(
                    f"Feedback volume spike in org {org_id}: "
                    f"{recent_count} submissions in last 24h exceeds "
                    f"{historical_count} submissions in prior 30 days."
                ),
            )
            alert_count += 1

    return alert_count


# ── Alert B: Repeat Blocks ────────────────────────────────────────────────


def _detect_repeat_blocks(db: Session) -> int:
    """Alert B — 2+ blocked submissions in 24h from the same user."""
    now = datetime.now(timezone.utc)
    twenty_four_hours_ago = now - timedelta(hours=24)

    alert_count = 0

    blocked_rows = (
        db.query(
            AuditLog.user_id,
            AuditLog.org_id,
            AuditLog.factory_id,
            func.count(AuditLog.id).label("cnt"),
        )
        .filter(
            AuditLog.action.in_([
                "FEEDBACK_BLOCKED_DATA_PATTERN",
                "FEEDBACK_BLOCKED_RATE_LIMIT",
            ]),
            AuditLog.user_id.is_not(None),
            AuditLog.timestamp >= twenty_four_hours_ago,
        )
        .group_by(AuditLog.user_id, AuditLog.org_id, AuditLog.factory_id)
        .all()
    )

    for row in blocked_rows:
        if int(row.cnt) >= 2:
            _write_anomaly_alert(
                db,
                alert_name="REPEAT_BLOCK",
                severity="high",
                user_id=row.user_id,
                org_id=row.org_id,
                factory_id=row.factory_id,
                detail=(
                    f"User {row.user_id} had {int(row.cnt)} blocked feedback "
                    f"submissions in last 24h — possible exfiltration probing."
                ),
            )
            alert_count += 1

    return alert_count


# ── Alert C: Block-Then-Success ───────────────────────────────────────────


def _detect_block_then_success(db: Session) -> int:
    """Alert C — Blocked submission followed by successful one within 10 min.

    Deduplicates by user_id per sweep cycle to avoid flooding the log when
    a user has multiple blocks followed by the same successful submission.
    """
    now = datetime.now(timezone.utc)
    twenty_four_hours_ago = now - timedelta(hours=24)

    alert_count = 0
    alerted_user_ids: set[int] = set()

    blocked_rows = (
        db.query(
            AuditLog.user_id,
            AuditLog.org_id,
            AuditLog.factory_id,
            AuditLog.timestamp,
        )
        .filter(
            AuditLog.action.in_([
                "FEEDBACK_BLOCKED_DATA_PATTERN",
                "FEEDBACK_BLOCKED_RATE_LIMIT",
            ]),
            AuditLog.timestamp >= twenty_four_hours_ago,
        )
        .order_by(AuditLog.timestamp.desc())
        .all()
    )

    for blocked_row in blocked_rows:
        if blocked_row.user_id is None or blocked_row.user_id in alerted_user_ids:
            continue

        block_time = blocked_row.timestamp
        window_end = block_time + timedelta(minutes=10)

        success_count = (
            db.query(func.count(AuditLog.id))
            .filter(
                AuditLog.action == "FEEDBACK_SUBMIT",
                AuditLog.user_id == blocked_row.user_id,
                AuditLog.timestamp > block_time,
                AuditLog.timestamp <= window_end,
            )
            .scalar()
            or 0
        )

        if success_count > 0:
            _write_anomaly_alert(
                db,
                alert_name="BLOCK_THEN_SUCCESS",
                severity="high",
                user_id=blocked_row.user_id,
                org_id=blocked_row.org_id,
                factory_id=blocked_row.factory_id,
                detail=(
                    f"User {blocked_row.user_id} had a blocked feedback submission "
                    f"followed by {success_count} successful submission(s) within "
                    f"10 minutes — possible pattern probing."
                ),
            )
            alert_count += 1
            alerted_user_ids.add(blocked_row.user_id)

    return alert_count


# ── Detector Service ──────────────────────────────────────────────────────


class FeedbackAnomalyDetector:
    """Background anomaly detection for feedback channel abuse."""

    def __init__(self, poll_interval_seconds: float = FEEDBACK_ANOMALY_POLL_SECONDS_DEFAULT) -> None:
        self.poll_interval_seconds = max(30.0, poll_interval_seconds)
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        if self._thread is not None:
            return
        self._stop.clear()
        self._thread = threading.Thread(
            target=self._loop,
            name="feedback-anomaly-detector",
            daemon=True,
        )
        self._thread.start()
        logger.info(
            "Feedback anomaly detector started (poll_interval=%.0fs).",
            self.poll_interval_seconds,
        )

    def stop(self) -> None:
        self._stop.set()
        if self._thread is not None:
            self._thread.join(timeout=2.0)
            self._thread = None
        logger.info("Feedback anomaly detector stopped.")

    def _loop(self) -> None:
        while not self._stop.is_set():
            try:
                self._run_once()
            except Exception:
                logger.exception("Feedback anomaly detection sweep failed.")
            if self._stop.wait(self.poll_interval_seconds):
                break

    @staticmethod
    def _run_once() -> None:
        with SessionLocal() as db:
            results: list[tuple[str, int]] = []

            count_a = _detect_volume_spike(db)
            if count_a:
                results.append(("VOLUME_SPIKE", count_a))

            count_b = _detect_repeat_blocks(db)
            if count_b:
                results.append(("REPEAT_BLOCK", count_b))

            count_c = _detect_block_then_success(db)
            if count_c:
                results.append(("BLOCK_THEN_SUCCESS", count_c))

            if results:
                db.commit()
                for name, count in results:
                    logger.info(
                        "Feedback anomaly detected: %s — %d alert(s) written.",
                        name, count,
                    )
            else:
                db.rollback()


# ── Module-level lifecycle functions ───────────────────────────────────────


def initialize_feedback_anomaly_detector() -> None:
    """Create and start the feedback anomaly detector.

    Called during application startup (main.py lifespan). No-op if the
    FEEDBACK_ANOMALY_ENABLED env var is explicitly set to false.
    """
    global _service
    enabled = _env_bool("FEEDBACK_ANOMALY_ENABLED", default=True)
    if not enabled:
        logger.info("Feedback anomaly detector disabled via env var.")
        return

    with _service_lock:
        if _service is not None:
            return
        poll_seconds = _env_float(
            "FEEDBACK_ANOMALY_POLL_SECONDS",
            FEEDBACK_ANOMALY_POLL_SECONDS_DEFAULT,
        )
        service = FeedbackAnomalyDetector(poll_interval_seconds=poll_seconds)
        service.start()
        _service = service


def shutdown_feedback_anomaly_detector() -> None:
    """Stop the feedback anomaly detector.

    Called during application shutdown (main.py lifespan finally).
    """
    global _service
    with _service_lock:
        if _service is None:
            return
        _service.stop()
        _service = None
