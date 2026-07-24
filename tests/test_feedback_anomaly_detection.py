"""Unit tests for the feedback anomaly detection service.

Tests the three detection functions from
backend/services/feedback_anomaly_detection.py:

    Alert A — _detect_volume_spike
    Alert B — _detect_repeat_blocks
    Alert C — _detect_block_then_success

Each test seeds the AuditLog table directly and asserts that the correct
number of anomaly alerts (also AuditLog entries with FEEDBACK_ANOMALY_*
actions) are produced.

Each test seeds the ``AuditLog`` table directly via a session with FK
enforcement disabled (the ``AuditLog.user_id`` FK references ``users.id``,
but the test database does not contain user records).  Assertions on
alert detail strings are done inside the ``with FKDisabledSession()``
block to avoid ``DetachedInstanceError`` after the session closes.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import text

from backend.database import SessionLocal
from backend.models.report import AuditLog
from backend.services.feedback_anomaly_detection import (
    _detect_block_then_success,
    _detect_repeat_blocks,
    _detect_volume_spike,
)


# ── Helpers ──────────────────────────────────────────────────────────────────

_ORG_A = "org-alpha"
_ORG_B = "org-beta"
_FACTORY_A = "fact-alpha-001"
_USER_1 = 101
_USER_2 = 102
_USER_3 = 103


# init_db is called automatically by the session-scoped ensure_backend fixture
# in tests/conftest.py. Tests should NOT call init_db() directly to avoid
# index-already-exists conflicts when the same SQLite database is reused.


class FKDisabledSession:
    """Context manager that provides a session with FK enforcement disabled.

    The AuditLog model has a FK to ``users.id``, but the test database does
    not contain user records. We turn off foreign key checks for each test
    to avoid ``IntegrityError`` on inserts with arbitrary user_id values.
    This is safe because the tests only query the ``AuditLog`` table; no
    referential integrity with ``users`` is exercised.

    We set ``PRAGMA foreign_keys=OFF`` on the raw DBAPI connection directly
    (bypassing the ORM session transaction), which persists for the lifetime
    of that connection.  The session owns the connection until ``close()``
    returns it to the pool.
    """

    def __enter__(self):
        self._db = SessionLocal()
        # Set PRAGMA directly on the DBAPI connection so it survives
        # across transaction boundaries within this session's lifetime.
        raw_conn = self._db.connection().connection
        raw_conn.execute("PRAGMA foreign_keys=OFF")
        return self._db

    def __exit__(self, *args):
        # Reset PRAGMA before returning connection to pool so other tests
        # that expect FK enforcement aren't silently affected.
        raw_conn = self._db.connection().connection
        raw_conn.execute("PRAGMA foreign_keys=ON")
        self._db.close()



def _insert(
    db: SessionLocal,
    *,
    action: str,
    user_id: int | None = None,
    org_id: str | None = None,
    factory_id: str | None = None,
    timestamp: datetime | None = None,
) -> AuditLog:
    """Insert a single AuditLog row and return it (uncommitted)."""
    row = AuditLog(
        user_id=user_id,
        org_id=org_id,
        factory_id=factory_id,
        action=action,
        details="test",
        ip_address=None,
        timestamp=timestamp or datetime.now(timezone.utc),
    )
    db.add(row)
    return row


def _anomaly_count(db: SessionLocal, *, alert_name: str) -> int:
    """Count anomaly alert rows written during the current transaction."""
    return (
        db.query(AuditLog)
        .filter(AuditLog.action == f"FEEDBACK_ANOMALY_{alert_name}")
        .count()
    )


def _wipe_audit_log(db: SessionLocal) -> None:
    db.query(AuditLog).delete()


# ── Alert A: Volume Spike ────────────────────────────────────────────────────


class TestDetectVolumeSpike:
    """_detect_volume_spike compares recent 24h SUBMIT events against the
    prior 30 days per org. An alert fires *only* when the org has non-zero
    historical activity AND recent exceeds the historical count.
    """

    def _seed(
        self,
        db: SessionLocal,
        *,
        org_id: str,
        recent_count: int,
        historical_count: int,
    ) -> None:
        """Seed AuditLog rows for a single org.

        Places ``historical_count`` SUBMIT rows 20–25 days ago (inside the
        30-day window) and ``recent_count`` SUBMIT rows within the last hour.
        """
        now = datetime.now(timezone.utc)
        for i in range(historical_count):
            _insert(
                db,
                action="FEEDBACK_SUBMIT",
                org_id=org_id,
                factory_id=_FACTORY_A,
                user_id=_USER_1,
                # well inside the 31d→24h window (~20 days ago)
                timestamp=now - timedelta(days=20, hours=i),
            )
        for i in range(recent_count):
            _insert(
                db,
                action="FEEDBACK_SUBMIT",
                org_id=org_id,
                factory_id=_FACTORY_A,
                user_id=_USER_1,
                # inside the last 24h
                timestamp=now - timedelta(minutes=30 * (i + 1)),
            )
        db.flush()

    def test_no_spike_when_recent_equals_historical(self):
        """Alert does NOT fire when recent == historical (threshold is >)."""
        with FKDisabledSession() as db:
            _wipe_audit_log(db)
            self._seed(db, org_id=_ORG_A, recent_count=5, historical_count=5)
            count = _detect_volume_spike(db)
            db.rollback()  # discard any anomaly rows written
        assert count == 0

    def test_no_spike_when_recent_below_historical(self):
        """Alert does NOT fire when recent < historical."""
        with FKDisabledSession() as db:
            _wipe_audit_log(db)
            self._seed(db, org_id=_ORG_A, recent_count=2, historical_count=10)
            count = _detect_volume_spike(db)
            db.rollback()
        assert count == 0

    def test_spike_fires_when_recent_exceeds_historical(self):
        """Alert fires when recent > historical for an org with history."""
        with FKDisabledSession() as db:
            _wipe_audit_log(db)
            self._seed(db, org_id=_ORG_A, recent_count=11, historical_count=5)
            count = _detect_volume_spike(db)
            # Flush so anomaly alert rows written by the detector are visible
            db.flush()
            alert_count = _anomaly_count(db, alert_name="VOLUME_SPIKE")
            db.rollback()
        assert count == 1
        assert alert_count == 1

    def test_no_spike_when_historical_is_zero(self):
        """Alert does NOT fire when there is zero historical data — the
        guard `if historical_count > 0` prevents false positives on brand
        new orgs that just started using feedback.
        """
        with FKDisabledSession() as db:
            _wipe_audit_log(db)
            self._seed(db, org_id=_ORG_A, recent_count=10, historical_count=0)
            count = _detect_volume_spike(db)
            db.rollback()
        assert count == 0

    def test_spike_isolated_per_org(self):
        """Only the org with the spike gets an alert; the quiet org does
        not.
        """
        with FKDisabledSession() as db:
            _wipe_audit_log(db)
            self._seed(db, org_id=_ORG_A, recent_count=20, historical_count=3)
            self._seed(db, org_id=_ORG_B, recent_count=2, historical_count=10)
            count = _detect_volume_spike(db)
            db.rollback()
        assert count == 1  # only _ORG_A should spike

    def test_no_spike_when_only_one_event_type_present(self):
        """Only FEEDBACK_SUBMIT events are counted; other actions are
        ignored.
        """
        with FKDisabledSession() as db:
            _wipe_audit_log(db)
            self._seed(db, org_id=_ORG_A, recent_count=3, historical_count=1)
            # Add non-SUBMIT events that should not affect the count
            now = datetime.now(timezone.utc)
            _insert(
                db,
                action="FEEDBACK_BLOCKED_DATA_PATTERN",
                org_id=_ORG_A,
                timestamp=now - timedelta(minutes=5),
            )
            _insert(
                db,
                action="FEEDBACK_BLOCKED_RATE_LIMIT",
                org_id=_ORG_A,
                timestamp=now - timedelta(minutes=10),
            )
            db.flush()
            count = _detect_volume_spike(db)
            db.rollback()
        assert count == 1  # 3 recent > 1 historical regardless of other types

    def test_spike_alert_detail_contains_org_id_and_counts(self):
        """The written alert AuditLog row has a meaningful detail string."""
        with FKDisabledSession() as db:
            _wipe_audit_log(db)
            self._seed(db, org_id=_ORG_A, recent_count=15, historical_count=4)
            _detect_volume_spike(db)
            db.flush()
            alert = (
                db.query(AuditLog)
                .filter(AuditLog.action == "FEEDBACK_ANOMALY_VOLUME_SPIKE")
                .first()
            )
            assert alert is not None
            assert alert.org_id == _ORG_A
            assert "15" in alert.details
            assert "4" in alert.details
            db.rollback()


# ── Alert B: Repeat Blocks ───────────────────────────────────────────────────


class TestDetectRepeatBlocks:
    """_detect_repeat_blocks alerts when the same user has ≥2 blocked
    submissions (data-pattern OR rate-limit) in 24h.
    """

    def _seed_block(
        self,
        db: SessionLocal,
        *,
        user_id: int,
        org_id: str = _ORG_A,
        factory_id: str = _FACTORY_A,
        minutes_ago: int = 5,
    ) -> None:
        """Insert a single blocked-submission audit row."""
        now = datetime.now(timezone.utc)
        _insert(
            db,
            action="FEEDBACK_BLOCKED_DATA_PATTERN",
            user_id=user_id,
            org_id=org_id,
            factory_id=factory_id,
            timestamp=now - timedelta(minutes=minutes_ago),
        )

    def _seed_rate_block(
        self,
        db: SessionLocal,
        *,
        user_id: int,
        org_id: str = _ORG_A,
        factory_id: str = _FACTORY_A,
        minutes_ago: int = 5,
    ) -> None:
        """Insert a single rate-limit block audit row."""
        now = datetime.now(timezone.utc)
        _insert(
            db,
            action="FEEDBACK_BLOCKED_RATE_LIMIT",
            user_id=user_id,
            org_id=org_id,
            factory_id=factory_id,
            timestamp=now - timedelta(minutes=minutes_ago),
        )

    def test_no_alert_when_single_block(self):
        """A single block does not trigger an alert (threshold is 2)."""
        with FKDisabledSession() as db:
            _wipe_audit_log(db)
            self._seed_block(db, user_id=_USER_1)
            db.flush()
            count = _detect_repeat_blocks(db)
            db.rollback()
        assert count == 0

    def test_alert_fires_at_two_data_pattern_blocks(self):
        """Two data-pattern blocks from the same user trigger an alert."""
        with FKDisabledSession() as db:
            _wipe_audit_log(db)
            self._seed_block(db, user_id=_USER_1, minutes_ago=10)
            self._seed_block(db, user_id=_USER_1, minutes_ago=5)
            db.flush()
            count = _detect_repeat_blocks(db)
            db.flush()
            alert_count = _anomaly_count(db, alert_name="REPEAT_BLOCK")
            db.rollback()
        assert count == 1
        assert alert_count == 1

    def test_mixed_block_types_count_together(self):
        """One data-pattern block + one rate-limit block count as 2."""
        with FKDisabledSession() as db:
            _wipe_audit_log(db)
            self._seed_block(db, user_id=_USER_1, minutes_ago=10)
            self._seed_rate_block(db, user_id=_USER_1, minutes_ago=3)
            db.flush()
            count = _detect_repeat_blocks(db)
            db.rollback()
        assert count == 1

    def test_alert_fires_at_three_blocks(self):
        """Three blocks still produce one alert per user."""
        with FKDisabledSession() as db:
            _wipe_audit_log(db)
            for i in range(3):
                self._seed_block(db, user_id=_USER_1, minutes_ago=5 * (i + 1))
            db.flush()
            count = _detect_repeat_blocks(db)
            db.flush()
            alert_count = _anomaly_count(db, alert_name="REPEAT_BLOCK")
            db.rollback()
        assert count == 1
        assert alert_count == 1

    def test_multiple_users_independent_alerts(self):
        """Two users who each exceed the threshold each get an alert."""
        with FKDisabledSession() as db:
            _wipe_audit_log(db)
            for i in range(2):
                self._seed_block(db, user_id=_USER_1, minutes_ago=10 * (i + 1))
                self._seed_block(db, user_id=_USER_2, minutes_ago=10 * (i + 1))
            db.flush()
            count = _detect_repeat_blocks(db)
            db.rollback()
        assert count == 2

    def test_one_user_above_one_below(self):
        """Only the user with ≥2 blocks gets an alert."""
        with FKDisabledSession() as db:
            _wipe_audit_log(db)
            self._seed_block(db, user_id=_USER_1, minutes_ago=10)
            self._seed_block(db, user_id=_USER_1, minutes_ago=5)  # user1: 2
            self._seed_block(db, user_id=_USER_2, minutes_ago=5)  # user2: 1
            db.flush()
            count = _detect_repeat_blocks(db)
            db.rollback()
        assert count == 1

    def test_old_blocks_outside_24h_window_ignored(self):
        """Blocks older than 24h do not count toward the threshold."""
        with FKDisabledSession() as db:
            _wipe_audit_log(db)
            now = datetime.now(timezone.utc)
            # 2 recent blocks → alert
            _insert(
                db,
                action="FEEDBACK_BLOCKED_DATA_PATTERN",
                user_id=_USER_1,
                org_id=_ORG_A,
                timestamp=now - timedelta(hours=1),
            )
            _insert(
                db,
                action="FEEDBACK_BLOCKED_DATA_PATTERN",
                user_id=_USER_1,
                org_id=_ORG_A,
                timestamp=now - timedelta(hours=2),
            )
            # 1 old block (just outside 24h) should not be counted
            _insert(
                db,
                action="FEEDBACK_BLOCKED_DATA_PATTERN",
                user_id=_USER_1,
                org_id=_ORG_A,
                timestamp=now - timedelta(hours=25),
            )
            db.flush()
            count = _detect_repeat_blocks(db)
            db.rollback()
        assert count == 1

    def test_alert_detail_mentions_user_and_count(self):
        """Anomaly alert detail includes the user_id and the block count."""
        with FKDisabledSession() as db:
            _wipe_audit_log(db)
            for i in range(2):
                self._seed_block(db, user_id=_USER_1, minutes_ago=5 * (i + 1))
            db.flush()
            _detect_repeat_blocks(db)
            db.flush()
            alert = (
                db.query(AuditLog)
                .filter(AuditLog.action == "FEEDBACK_ANOMALY_REPEAT_BLOCK")
                .first()
            )
            assert alert is not None
            assert alert.user_id == _USER_1
            assert "2" in alert.details
            db.rollback()


# ── Alert C: Block-Then-Success ──────────────────────────────────────────────


class TestDetectBlockThenSuccess:
    """_detect_block_then_success alerts when a blocked submission is
    followed by a success within 10 minutes from the same user.
    """

    def _block(
        self,
        db: SessionLocal,
        *,
        user_id: int,
        org_id: str = _ORG_A,
        factory_id: str = _FACTORY_A,
        when: datetime | None = None,
        action: str = "FEEDBACK_BLOCKED_DATA_PATTERN",
    ) -> AuditLog:
        row = _insert(
            db,
            action=action,
            user_id=user_id,
            org_id=org_id,
            factory_id=factory_id,
            timestamp=when or (datetime.now(timezone.utc) - timedelta(minutes=15)),
        )
        return row

    def _success(
        self,
        db: SessionLocal,
        *,
        user_id: int,
        org_id: str = _ORG_A,
        factory_id: str = _FACTORY_A,
        when: datetime | None = None,
    ) -> AuditLog:
        row = _insert(
            db,
            action="FEEDBACK_SUBMIT",
            user_id=user_id,
            org_id=org_id,
            factory_id=factory_id,
            timestamp=when or datetime.now(timezone.utc),
        )
        return row

    def test_no_alert_when_no_success_after_block(self):
        """Block with no following success → no alert."""
        with FKDisabledSession() as db:
            _wipe_audit_log(db)
            now = datetime.now(timezone.utc)
            self._block(db, user_id=_USER_1, when=now - timedelta(minutes=30))
            # success *before* the block (1 min before)
            self._success(db, user_id=_USER_1, when=now - timedelta(minutes=31))
            db.flush()
            count = _detect_block_then_success(db)
            db.rollback()
        assert count == 0

    def test_alert_fires_when_success_within_10_min_of_block(self):
        """Block followed by success within 10 minutes → alert."""
        with FKDisabledSession() as db:
            _wipe_audit_log(db)
            now = datetime.now(timezone.utc)
            block_time = now - timedelta(minutes=15)
            success_time = block_time + timedelta(minutes=5)  # 5 min later
            self._block(db, user_id=_USER_1, when=block_time)
            self._success(db, user_id=_USER_1, when=success_time)
            db.flush()
            count = _detect_block_then_success(db)
            db.flush()
            alert_count = _anomaly_count(db, alert_name="BLOCK_THEN_SUCCESS")
            db.rollback()
        assert count == 1
        assert alert_count == 1

    def test_no_alert_when_success_outside_10_min_window(self):
        """Success at exactly 11 minutes after block → no alert."""
        with FKDisabledSession() as db:
            _wipe_audit_log(db)
            now = datetime.now(timezone.utc)
            block_time = now - timedelta(minutes=20)
            success_time = block_time + timedelta(minutes=11)  # just outside
            self._block(db, user_id=_USER_1, when=block_time)
            self._success(db, user_id=_USER_1, when=success_time)
            db.flush()
            count = _detect_block_then_success(db)
            db.rollback()
        assert count == 0

    def test_success_at_exactly_10_min_is_included(self):
        """Success at exactly 10 min after block → alert (≤ window)."""
        with FKDisabledSession() as db:
            _wipe_audit_log(db)
            now = datetime.now(timezone.utc)
            block_time = now - timedelta(minutes=20)
            success_time = block_time + timedelta(minutes=10)  # boundary
            self._block(db, user_id=_USER_1, when=block_time)
            self._success(db, user_id=_USER_1, when=success_time)
            db.flush()
            count = _detect_block_then_success(db)
            db.rollback()
        assert count == 1

    def test_dedup_multiple_blocks_one_success(self):
        """Multiple blocks followed by one success = one alert per user."""
        with FKDisabledSession() as db:
            _wipe_audit_log(db)
            now = datetime.now(timezone.utc)
            block_time_a = now - timedelta(minutes=30)
            block_time_b = now - timedelta(minutes=25)
            success_time = block_time_b + timedelta(minutes=3)
            self._block(db, user_id=_USER_1, when=block_time_a)
            self._block(db, user_id=_USER_1, when=block_time_b)
            self._success(db, user_id=_USER_1, when=success_time)
            db.flush()
            count = _detect_block_then_success(db)
            db.flush()
            alert_count = _anomaly_count(db, alert_name="BLOCK_THEN_SUCCESS")
            db.rollback()
        assert count == 1
        assert alert_count == 1

    def test_multiple_users_dedup_independently(self):
        """Two users each with block+success = two alerts."""
        with FKDisabledSession() as db:
            _wipe_audit_log(db)
            now = datetime.now(timezone.utc)
            for uid in (_USER_1, _USER_2):
                bt = now - timedelta(minutes=15)
                st = bt + timedelta(minutes=3)
                self._block(db, user_id=uid, when=bt)
                self._success(db, user_id=uid, when=st)
            db.flush()
            count = _detect_block_then_success(db)
            db.rollback()
        assert count == 2

    def test_only_submit_events_count_as_success(self):
        """Only FEEDBACK_SUBMIT is treated as success; other events are
        ignored.
        """
        with FKDisabledSession() as db:
            _wipe_audit_log(db)
            now = datetime.now(timezone.utc)
            block_time = now - timedelta(minutes=15)
            self._block(db, user_id=_USER_1, when=block_time)
            # A VIEWED event shouldn't count as success
            _insert(
                db,
                action="FEEDBACK_VIEWED",
                user_id=_USER_1,
                org_id=_ORG_A,
                timestamp=block_time + timedelta(minutes=3),
            )
            db.flush()
            count = _detect_block_then_success(db)
            db.rollback()
        assert count == 0

    def test_old_blocks_outside_24h_ignored(self):
        """Blocks older than 24h are not considered."""
        with FKDisabledSession() as db:
            _wipe_audit_log(db)
            now = datetime.now(timezone.utc)
            old_block = now - timedelta(hours=25)
            success_after_old = old_block + timedelta(minutes=3)
            self._block(db, user_id=_USER_1, when=old_block)
            self._success(db, user_id=_USER_1, when=success_after_old)
            # Also add a recent block without success (should not trigger)
            self._block(db, user_id=_USER_1, when=now - timedelta(minutes=10))
            db.flush()
            count = _detect_block_then_success(db)
            db.rollback()
        assert count == 0

    def test_alert_detail_contains_user_id_and_success_count(self):
        """Anomaly alert detail mentions the user_id and success count."""
        with FKDisabledSession() as db:
            _wipe_audit_log(db)
            now = datetime.now(timezone.utc)
            block_time = now - timedelta(minutes=15)
            self._block(db, user_id=_USER_1, when=block_time)
            self._success(db, user_id=_USER_1, when=block_time + timedelta(minutes=2))
            self._success(db, user_id=_USER_1, when=block_time + timedelta(minutes=5))
            db.flush()
            _detect_block_then_success(db)
            db.flush()
            alert = (
                db.query(AuditLog)
                .filter(AuditLog.action == "FEEDBACK_ANOMALY_BLOCK_THEN_SUCCESS")
                .first()
            )
            assert alert is not None
            assert alert.user_id == _USER_1
            assert str(_USER_1) in alert.details
            db.rollback()

    def test_rate_limit_block_also_triggers_block_then_success(self):
        """A rate-limit block followed by success also triggers Alert C."""
        with FKDisabledSession() as db:
            _wipe_audit_log(db)
            now = datetime.now(timezone.utc)
            block_time = now - timedelta(minutes=15)
            self._block(
                db,
                user_id=_USER_1,
                when=block_time,
                action="FEEDBACK_BLOCKED_RATE_LIMIT",
            )
            self._success(db, user_id=_USER_1, when=block_time + timedelta(minutes=3))
            db.flush()
            count = _detect_block_then_success(db)
            db.rollback()
        assert count == 1


# ── Cross-Alert: Combined Scenario ───────────────────────────────────────────


class TestCrossAlertScenarios:
    """Integration-style tests that exercise all three detectors against a
    single dataset to confirm they don't interfere.
    """

    def test_mixed_activity_produces_correct_alerts(self):
        """A rich scenario with multiple orgs and users:
        - _ORG_A / _USER_1: 20 recent SUBMITs, 3 historical → Alert A ✓
        - _ORG_B / _USER_2: 1 recent SUBMIT, 10 historical → no alert
        - _USER_1: 3 blocks in 24h → Alert B ✓
        - _USER_2: 1 block → no alert
        - _USER_1: block then success within 10 min → Alert C ✓
        - _USER_3: block then success at 15 min → no alert
        """
        with FKDisabledSession() as db:
            _wipe_audit_log(db)
            now = datetime.now(timezone.utc)

            # ── Data for _ORG_A / _USER_1 (should trigger A, B, C) ──
            # Historical (30-day window)
            for i in range(3):
                _insert(
                    db,
                    action="FEEDBACK_SUBMIT", org_id=_ORG_A, user_id=_USER_1,
                    timestamp=now - timedelta(days=20, hours=i),
                )
            # Recent (last 24h)
            for i in range(20):
                _insert(
                    db,
                    action="FEEDBACK_SUBMIT", org_id=_ORG_A, user_id=_USER_1,
                    timestamp=now - timedelta(minutes=30 * (i + 1)),
                )
            # 3 blocks for _USER_1
            for i in range(3):
                _insert(
                    db,
                    action="FEEDBACK_BLOCKED_DATA_PATTERN", org_id=_ORG_A,
                    user_id=_USER_1, factory_id=_FACTORY_A,
                    timestamp=now - timedelta(minutes=5 * (i + 1)),
                )
            # Block + success for _USER_1 (within 10 min)
            block_c_time = now - timedelta(minutes=20)
            _insert(
                db,
                action="FEEDBACK_BLOCKED_DATA_PATTERN", org_id=_ORG_A,
                user_id=_USER_1, factory_id=_FACTORY_A,
                timestamp=block_c_time,
            )
            _insert(
                db,
                action="FEEDBACK_SUBMIT", org_id=_ORG_A,
                user_id=_USER_1, factory_id=_FACTORY_A,
                timestamp=block_c_time + timedelta(minutes=3),
            )

            # ── Data for _ORG_B / _USER_2 (no alerts) ──
            for i in range(10):
                _insert(
                    db,
                    action="FEEDBACK_SUBMIT", org_id=_ORG_B, user_id=_USER_2,
                    timestamp=now - timedelta(days=20, hours=i),
                )
            _insert(
                db,
                action="FEEDBACK_SUBMIT", org_id=_ORG_B, user_id=_USER_2,
                timestamp=now - timedelta(minutes=30),
            )
            _insert(
                db,
                action="FEEDBACK_BLOCKED_DATA_PATTERN", org_id=_ORG_B,
                user_id=_USER_2, factory_id=_FACTORY_A,
                timestamp=now - timedelta(minutes=10),
            )

            # ── Data for _USER_3 (block + success at 15 min — too late) ──
            block_d_time = now - timedelta(minutes=30)
            _insert(
                db,
                action="FEEDBACK_BLOCKED_RATE_LIMIT", org_id=_ORG_A,
                user_id=_USER_3, factory_id=_FACTORY_A,
                timestamp=block_d_time,
            )
            _insert(
                db,
                action="FEEDBACK_SUBMIT", org_id=_ORG_A,
                user_id=_USER_3, factory_id=_FACTORY_A,
                timestamp=block_d_time + timedelta(minutes=15),
            )

            db.flush()

            # ── Run all three detectors ──
            count_a = _detect_volume_spike(db)
            count_b = _detect_repeat_blocks(db)
            count_c = _detect_block_then_success(db)

            db.flush()

            alerts_a = _anomaly_count(db, alert_name="VOLUME_SPIKE")
            alerts_b = _anomaly_count(db, alert_name="REPEAT_BLOCK")
            alerts_c = _anomaly_count(db, alert_name="BLOCK_THEN_SUCCESS")

            total_alerts = sum(
                _anomaly_count(db, alert_name=name)
                for name in ("VOLUME_SPIKE", "REPEAT_BLOCK", "BLOCK_THEN_SUCCESS")
            )

            db.rollback()

        assert count_a == 1, f"Expected 1 volume spike alert, got {count_a}"
        assert alerts_a == 1

        assert count_b == 1, f"Expected 1 repeat block alert, got {count_b}"
        assert alerts_b == 1

        assert count_c == 1, (
            f"Expected 1 block-then-success alert, got {count_c}"
        )
        assert alerts_c == 1

        assert total_alerts == 3, (
            f"Expected exactly 3 anomaly alert rows, got {total_alerts}"
        )


# ── Edge Cases ───────────────────────────────────────────────────────────────


class TestEdgeCases:
    """Edge-case scenarios that should not crash or produce false alerts."""

    def test_empty_audit_log(self):
        """All detectors return 0 when there are no AuditLog rows."""
        with FKDisabledSession() as db:
            _wipe_audit_log(db)
            db.flush()
            a = _detect_volume_spike(db)
            b = _detect_repeat_blocks(db)
            c = _detect_block_then_success(db)
            db.rollback()
        assert a == 0
        assert b == 0
        assert c == 0

    def test_unrelated_audit_events_ignored(self):
        """Only FEEDBACK_* events are considered; other AuditLog rows
        are ignored.
        """
        with FKDisabledSession() as db:
            _wipe_audit_log(db)
            now = datetime.now(timezone.utc)
            actions = [
                "USER_LOGIN", "USER_LOGOUT", "ENTRY_CREATED",
                "REPORT_EXPORTED", "INVOICE_PAID",
            ]
            for action in actions:
                for _ in range(10):
                    _insert(db, action=action, timestamp=now - timedelta(hours=1))
            db.flush()
            a = _detect_volume_spike(db)
            b = _detect_repeat_blocks(db)
            c = _detect_block_then_success(db)
            db.rollback()
        assert a == 0
        assert b == 0
        assert c == 0

    def test_blocks_with_null_user_id_skipped(self):
        """Alert B and C skip rows where user_id is None."""
        with FKDisabledSession() as db:
            _wipe_audit_log(db)
            now = datetime.now(timezone.utc)
            # Blocks with null user_id
            _insert(
                db, action="FEEDBACK_BLOCKED_DATA_PATTERN",
                user_id=None, org_id=_ORG_A,
                timestamp=now - timedelta(minutes=10),
            )
            _insert(
                db, action="FEEDBACK_BLOCKED_DATA_PATTERN",
                user_id=None, org_id=_ORG_A,
                timestamp=now - timedelta(minutes=5),
            )
            db.flush()
            b = _detect_repeat_blocks(db)
            c = _detect_block_then_success(db)
            db.rollback()
        assert b == 0, (
            f"Expected b == 0 (null user_ids should be skipped), got {b}. "
            "Make sure _detect_repeat_blocks has AuditLog.user_id.is_not(None) filter."
        )
        assert c == 0
