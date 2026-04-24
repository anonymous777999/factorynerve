from __future__ import annotations

from datetime import date, datetime, timezone
import queue
import sys
import time
from types import SimpleNamespace

from fastapi.testclient import TestClient
import pytest

from backend.database import SessionLocal, init_db
from backend.models.admin_alert_recipient import AdminAlertRecipient
from backend.models.organization import Organization
from backend.main import app
from backend.models.phone_verification import PhoneVerificationStatus
from backend.models.ops_alert_event import OpsAlertEvent
from backend.ocr_jobs import enqueue_job
import backend.ocr_jobs as ocr_jobs
from backend.routers import billing as billing_router
from backend.services.ops_alerts.detectors import (
    build_exception_fingerprint,
    evaluate_5xx_spike,
    evaluate_abnormal_error_rate,
    evaluate_auth_anomaly,
    evaluate_ocr_failure_spike,
)
from backend.services.ops_alerts.dispatcher import AlertDispatcher
from backend.services.ops_alerts.formatter import format_alert_message
from backend.services.ops_alerts.providers import TwilioWhatsAppProvider
from backend.services.ops_alerts.recipients import resolve_alert_delivery_targets
from backend.services.ops_alerts.rate_limit import InMemoryAlertRateLimiter, RedisAlertRateLimiter
from backend.services.ops_alerts.service import OpsAlertService, OpsAlertSettings, build_alert_settings
from backend.services.ops_alerts.types import AlertCandidate, AlertEventType, AlertSeverity


def _enabled_settings() -> OpsAlertSettings:
    return OpsAlertSettings(
        app_name="DPR.ai",
        app_env="production",
        deployment_env="production",
        allowed_deployment_envs=("production",),
        alerts_requested=True,
        enabled=True,
        provider_name="twilio",
        timezone_name="Asia/Kolkata",
        dispatch_workers=1,
        retry_attempts=1,
        retry_backoff_seconds=0.01,
        default_cooldown_seconds=600,
        t1_5xx_window_seconds=300,
        t1_5xx_min_count=10,
        t1_5xx_min_percent=5.0,
        t2_ocr_window_seconds=300,
        t2_ocr_min_failures=10,
        t4_auth_window_seconds=600,
        t4_auth_min_attempts=8,
        t5_error_window_seconds=300,
        t5_min_requests=100,
        t5_warn_percent=5.0,
        t5_critical_percent=15.0,
        org_rate_limit_window_seconds=600,
        org_rate_limit_normal_max=20,
        org_rate_limit_critical_max=50,
        escalation_window_seconds=1800,
        escalation_high_repeat_count=3,
        escalation_critical_repeat_count=5,
        daily_summary_hour_utc=18,
        daily_summary_minute_utc=0,
    )


def test_formatter_matches_required_whatsapp_structure():
    candidate = AlertCandidate(
        event_type=AlertEventType.OCR_FAILURE_SPIKE,
        severity=AlertSeverity.HIGH,
        summary="12 OCR extraction failures in the last 5 minutes exceeded the threshold of 10.",
        dedup_key="t2:ocr-failure-spike",
        meta={
            "failures": 12,
            "window": "5m",
            "threshold": 10,
            "top_error": "timeout",
        },
        timestamp=datetime(2026, 4, 23, 17, 12, 0, tzinfo=timezone.utc),
        ref_id="ocr-1776964320-a3f",
    )

    message = format_alert_message(
        candidate,
        app_name="DPR.ai",
        env_name="production",
        timezone_name="Asia/Kolkata",
    )

    assert message.startswith("🚨 HIGH — OCR Failure Spike\n")
    assert "Org: DPR.ai | App: DPR.ai | Env: production" in message
    assert "Time: 2026-04-23T22:42:00+05:30" in message
    assert "Context: 12 OCR extraction failures in the last 5 minutes exceeded the threshold of 10." in message
    assert "Meta: failures: 12 | window: 5m | threshold: 10 | top_error: timeout" in message
    assert message.endswith("Ref ID: ocr-1776964320-a3f")


def test_build_alert_settings_stays_disabled_outside_production(monkeypatch):
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("ALERTS_ENABLED", "true")

    settings = build_alert_settings()

    assert settings.enabled is False


def test_build_alert_settings_requires_allowed_deployment_env(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("DEPLOYMENT_ENV", "staging")
    monkeypatch.setenv("ALERTS_ENABLED", "true")

    settings = build_alert_settings()

    assert settings.enabled is False
    assert settings.deployment_env == "staging"


def test_twilio_provider_validate_config_requires_secrets(monkeypatch):
    monkeypatch.delenv("TWILIO_ACCOUNT_SID", raising=False)
    monkeypatch.delenv("TWILIO_AUTH_TOKEN", raising=False)
    monkeypatch.delenv("TWILIO_WHATSAPP_FROM", raising=False)

    provider = TwilioWhatsAppProvider()

    with pytest.raises(ValueError):
        provider.validate_config()


def test_in_memory_rate_limiter_blocks_duplicates_inside_cooldown():
    limiter = InMemoryAlertRateLimiter()

    assert limiter.acquire("t2:ocr-failure-spike", 60) is True
    assert limiter.acquire("t2:ocr-failure-spike", 60) is False
    limiter.release("t2:ocr-failure-spike")
    assert limiter.acquire("t2:ocr-failure-spike", 60) is True


def test_redis_rate_limiter_uses_set_nx_semantics():
    class FakeRedis:
        def __init__(self):
            self.entries: dict[str, str] = {}

        def set(self, key, value, nx=False, ex=None):
            if nx and key in self.entries:
                return False
            self.entries[key] = value
            return True

        def delete(self, key):
            self.entries.pop(key, None)

    limiter = RedisAlertRateLimiter(FakeRedis())

    assert limiter.acquire("t4:auth:hash", 60) is True
    assert limiter.acquire("t4:auth:hash", 60) is False
    limiter.release("t4:auth:hash")
    assert limiter.acquire("t4:auth:hash", 60) is True


def test_detector_thresholds_fire_only_when_limits_are_crossed():
    assert evaluate_5xx_spike(total_requests=50, error_requests=2, min_count=10, min_percent=5.0) is None
    assert evaluate_5xx_spike(total_requests=100, error_requests=10, min_count=10, min_percent=5.0) is not None
    assert evaluate_abnormal_error_rate(
        total_requests=100,
        error_requests=16,
        min_requests=100,
        warn_percent=5.0,
        critical_percent=15.0,
    )["severity"] == "critical"
    assert evaluate_auth_anomaly(attempts=7, threshold=8) is None
    assert evaluate_auth_anomaly(attempts=8, threshold=8) is not None
    assert evaluate_ocr_failure_spike(
        failures=[{"job_id": f"job-{index}", "error": "timeout"} for index in range(10)],
        min_failures=10,
    )["top_error"] == "timeout"


def test_exception_fingerprint_ignores_user_controlled_error_text():
    first = build_exception_fingerprint(path="/reports", error=RuntimeError("bad payload a"))
    second = build_exception_fingerprint(path="/reports", error=RuntimeError("bad payload b"))

    assert first == second


def test_twilio_provider_handles_success_and_retryable_failure(monkeypatch):
    provider = TwilioWhatsAppProvider()
    provider.account_sid = "sid"
    provider.auth_token = "token"
    provider.from_number = "whatsapp:+14155238886"
    provider.default_to_number = ""

    class FakeMessages:
        def create(self, **kwargs):
            return SimpleNamespace(sid="SM123", status="queued")

    class FakeClient:
        messages = FakeMessages()

    monkeypatch.setattr(provider, "_build_client", lambda: FakeClient())
    result = provider.deliver("hello", to_number="+919999999999")
    assert result.success is True
    assert result.external_id == "SM123"

    class RetryableError(RuntimeError):
        status = 503

    provider.default_to_number = "+919999999999"
    monkeypatch.setattr(provider, "_build_client", lambda: (_ for _ in ()).throw(RetryableError("twilio down")))
    failed = provider.deliver("hello")
    assert failed.success is False
    assert failed.retryable is True


def test_service_deduplicates_alert_enqueues():
    service = OpsAlertService(_enabled_settings())
    enqueued: list[str] = []
    service._dispatcher = SimpleNamespace(
        enqueue=lambda candidate: enqueued.append(candidate.dedup_key) or True,
        record_suppressed=lambda candidate, reason: None,
    )
    service._rate_limiter = InMemoryAlertRateLimiter()

    candidate = AlertCandidate(
        event_type=AlertEventType.OCR_FAILURE_SPIKE,
        severity=AlertSeverity.HIGH,
        summary="OCR failures exceeded threshold.",
        dedup_key="t2:ocr-failure-spike",
    )
    service.emit_alert_candidate(candidate)
    service.emit_alert_candidate(candidate)

    assert enqueued == ["t2:ocr-failure-spike"]


def test_service_drops_alerts_when_dispatcher_is_unavailable():
    init_db()
    service = OpsAlertService(_enabled_settings())
    service._rate_limiter = InMemoryAlertRateLimiter()
    service._dispatcher = SimpleNamespace(
        enqueue=lambda candidate: False,
        record_drop=lambda candidate, reason: AlertDispatcher(
            provider=SimpleNamespace(name="twilio", deliver=lambda message, to_number=None: None),
            app_name="DPR.ai",
            env_name="production",
            timezone_name="Asia/Kolkata",
            worker_count=1,
            retry_attempts=1,
            retry_backoff_seconds=0.01,
        ).record_drop(candidate, reason=reason),
    )

    candidate = AlertCandidate(
        event_type=AlertEventType.SERVER_EXCEPTION,
        severity=AlertSeverity.CRITICAL,
        summary="Boom",
        dedup_key="t1:exception:/x:test",
        ref_id="srv-drop-1",
    )
    service.emit_alert_candidate(candidate)

    with SessionLocal() as db:
        row = db.query(OpsAlertEvent).filter(OpsAlertEvent.ref_id == "srv-drop-1").first()
        assert row is not None
        assert row.delivery_status == "dropped_queue_full"


def test_dispatcher_persists_delivery_history_rows(tmp_path):
    init_db()

    class FakeProvider:
        name = "twilio"

        def deliver(self, message: str, *, to_number: str | None = None):
            return SimpleNamespace(success=True, provider="twilio", retryable=False, error=None, external_id="SM9")

    dispatcher = AlertDispatcher(
        provider=FakeProvider(),
        app_name="DPR.ai",
        env_name="production",
        timezone_name="Asia/Kolkata",
        worker_count=1,
        retry_attempts=1,
        retry_backoff_seconds=0.01,
    )
    candidate = AlertCandidate(
        event_type=AlertEventType.SERVER_EXCEPTION,
        severity=AlertSeverity.CRITICAL,
        summary="Unhandled RuntimeError on GET /health.",
        dedup_key="t1:exception:/health:abc123",
        ref_id="srv-test-123",
        to_number="whatsapp:+919999999999",
    )

    dispatcher._deliver_candidate(candidate)

    with SessionLocal() as db:
        row = db.query(OpsAlertEvent).filter(OpsAlertEvent.ref_id == "srv-test-123").first()
        assert row is not None
        assert row.delivery_status == "delivered"
        assert row.attempt_count == 1
        assert row.recipient_phone == "whatsapp:+919999999999"


def test_dispatcher_continues_when_one_recipient_fails():
    init_db()

    with SessionLocal() as db:
        db.add(Organization(org_id="org-test", name="Org Test", plan="free"))
        db.commit()
        db.add_all(
                [
                AdminAlertRecipient(
                    org_id="org-test",
                    phone_number="+911111111111",
                    phone_e164="+911111111111",
                    verification_status=PhoneVerificationStatus.VERIFIED.value,
                    is_active=True,
                ),
                AdminAlertRecipient(
                    org_id="org-test",
                    phone_number="+922222222222",
                    phone_e164="+922222222222",
                    verification_status=PhoneVerificationStatus.VERIFIED.value,
                    is_active=True,
                ),
            ]
        )
        db.commit()

    class FakeProvider:
        name = "twilio"

        def deliver(self, message: str, *, to_number: str | None = None):
            if to_number == "whatsapp:+922222222222":
                return SimpleNamespace(success=False, provider="twilio", retryable=False, error="downstream reject")
            return SimpleNamespace(success=True, provider="twilio", retryable=False, error=None, external_id="SM9")

    dispatcher = AlertDispatcher(
        provider=FakeProvider(),
        app_name="DPR.ai",
        env_name="production",
        timezone_name="Asia/Kolkata",
        worker_count=1,
        retry_attempts=1,
        retry_backoff_seconds=0.01,
    )
    candidate = AlertCandidate(
        event_type=AlertEventType.PAYMENT_FAILURE,
        severity=AlertSeverity.HIGH,
        summary="Payment failed.",
        dedup_key="t3:payment:org-test:123",
        ref_id="pay-fanout-1",
        org_id="org-test",
    )

    dispatcher._deliver_candidate(candidate)

    with SessionLocal() as db:
        rows = db.query(OpsAlertEvent).filter(OpsAlertEvent.ref_id == "pay-fanout-1").all()
        assert len(rows) == 3
        root_row = next(row for row in rows if row.recipient_phone is None)
        assert root_row.status == "sent"
        assert root_row.delivery_status == "partial_failure"
        statuses = {row.recipient_phone: row.delivery_status for row in rows if row.recipient_phone is not None}
        assert statuses["whatsapp:+911111111111"] == "delivered"
        assert statuses["whatsapp:+922222222222"] == "failed"


def test_request_middleware_reports_auth_route_outcomes_without_blocking(monkeypatch):
    captured: list[tuple[str, int]] = []
    monkeypatch.setattr("backend.main.record_ops_request_outcome", lambda request, status_code, duration_ms: captured.append((request.url.path, status_code)))

    with TestClient(app) as client:
        response = client.post("/auth/login", json={"email": "missing@example.com", "password": "bad-pass"})

    assert response.status_code in {401, 422}
    assert captured
    assert captured[-1][0] == "/auth/login"


def test_only_login_paths_feed_auth_anomaly_tracking():
    service = OpsAlertService(_enabled_settings())
    captured: list[tuple[str, int]] = []
    service.record_auth_failure = lambda request, *, status_code, reason=None: captured.append((request.url.path, status_code))  # type: ignore[method-assign]

    login_request = SimpleNamespace(url=SimpleNamespace(path="/auth/login"))
    refresh_request = SimpleNamespace(url=SimpleNamespace(path="/auth/refresh"))

    service.record_request_outcome(login_request, 401, 10)  # type: ignore[arg-type]
    service.record_request_outcome(refresh_request, 401, 10)  # type: ignore[arg-type]

    assert captured == [("/auth/login", 401)]


def test_recipient_preferences_filter_delivery_targets():
    init_db()

    with SessionLocal() as db:
        db.add(Organization(org_id="org-pref", name="Pref Org", plan="free"))
        db.commit()
        db.add_all(
            [
                AdminAlertRecipient(
                    org_id="org-pref",
                    phone_number="+911111111111",
                    phone_e164="+911111111111",
                    verification_status=PhoneVerificationStatus.VERIFIED.value,
                    is_active=True,
                    event_types=None,
                    severity_levels=None,
                ),
                AdminAlertRecipient(
                    org_id="org-pref",
                    phone_number="+922222222222",
                    phone_e164="+922222222222",
                    verification_status=PhoneVerificationStatus.VERIFIED.value,
                    is_active=True,
                    event_types=[],
                    severity_levels=None,
                ),
                AdminAlertRecipient(
                    org_id="org-pref",
                    phone_number="+933333333333",
                    phone_e164="+933333333333",
                    verification_status=PhoneVerificationStatus.VERIFIED.value,
                    is_active=True,
                    event_types=[AlertEventType.AUTH_ANOMALY.value],
                    severity_levels=[AlertSeverity.CRITICAL.value],
                ),
            ]
        )
        db.commit()

        targets = resolve_alert_delivery_targets(
            db,
            org_id="org-pref",
            candidate=AlertCandidate(
                event_type=AlertEventType.OCR_FAILURE_SPIKE,
                severity=AlertSeverity.HIGH,
                summary="OCR failures exceeded threshold.",
                dedup_key="t2:ocr-failure-spike:org-pref",
                org_id="org-pref",
            ),
        )

    assert [target.phone_number for target in targets] == ["whatsapp:+911111111111"]


def test_org_rate_limited_alerts_are_persisted_as_suppressed():
    init_db()

    class FakeProvider:
        name = "twilio"

        def deliver(self, message: str, *, to_number: str | None = None):
            return SimpleNamespace(success=True, provider="twilio", retryable=False, error=None, external_id="SM10")

    settings = OpsAlertSettings(
        **{**_enabled_settings().__dict__, "org_rate_limit_normal_max": 1, "org_rate_limit_critical_max": 1}
    )
    service = OpsAlertService(settings, provider=FakeProvider())
    service._rate_limiter = InMemoryAlertRateLimiter()
    service.start()
    try:
        first = AlertCandidate(
            event_type=AlertEventType.OCR_FAILURE_SPIKE,
            severity=AlertSeverity.HIGH,
            summary="First alert.",
            dedup_key="t2:first",
            group_key="t2:first-group",
            ref_id="rate-limit-1",
            org_id="org-rate",
            org_name="Rate Org",
            to_number="whatsapp:+919999999999",
        )
        second = AlertCandidate(
            event_type=AlertEventType.OCR_FAILURE_SPIKE,
            severity=AlertSeverity.HIGH,
            summary="Second alert.",
            dedup_key="t2:second",
            group_key="t2:second-group",
            ref_id="rate-limit-2",
            org_id="org-rate",
            org_name="Rate Org",
            to_number="whatsapp:+919999999999",
        )
        service.emit_alert_candidate(first)
        time.sleep(0.1)
        service.emit_alert_candidate(second)
        time.sleep(0.1)
    finally:
        service.stop()

    with SessionLocal() as db:
        row = (
            db.query(OpsAlertEvent)
            .filter(
                OpsAlertEvent.ref_id == "rate-limit-2",
                OpsAlertEvent.recipient_phone.is_(None),
            )
            .first()
        )
        assert row is not None
        assert row.status == "suppressed"
        assert row.suppressed_reason == "org_rate_limited"


def test_daily_summary_creates_summary_record_and_alert():
    init_db()

    class FakeProvider:
        name = "twilio"

        def deliver(self, message: str, *, to_number: str | None = None):
            return SimpleNamespace(success=True, provider="twilio", retryable=False, error=None, external_id="SM11")

    summary_day = date(2026, 5, 1)
    summary_ts = datetime(2026, 5, 1, 10, 0, tzinfo=timezone.utc)

    with SessionLocal() as db:
        db.add(Organization(org_id="org-summary", name="Summary Org", plan="pro"))
        db.commit()
        db.add(
            AdminAlertRecipient(
                org_id="org-summary",
                phone_number="+911234567890",
                phone_e164="+911234567890",
                verification_status=PhoneVerificationStatus.VERIFIED.value,
                is_active=True,
                receive_daily_summary=True,
            )
        )
        db.add(
            OpsAlertEvent(
                ref_id="summary-source-1",
                org_id="org-summary",
                org_name="Summary Org",
                event_type=AlertEventType.OCR_FAILURE_SPIKE.value,
                severity=AlertSeverity.HIGH.value,
                status="sent",
                dedup_key="source:1",
                group_key="source-group:1",
                escalation_level=0,
                is_summary=False,
                summary="OCR failures exceeded threshold.",
                recipient_phone=None,
                meta={"failures": 12},
                provider="twilio",
                delivery_status="delivered",
                created_at=summary_ts,
            )
        )
        db.commit()

    service = OpsAlertService(_enabled_settings(), provider=FakeProvider())
    service.start()
    try:
        sent = service.run_daily_summary_once(summary_date=summary_day)
        time.sleep(0.1)
    finally:
        service.stop()

    assert sent == 1
    with SessionLocal() as db:
        summary_row = (
            db.query(OpsAlertEvent)
            .filter(
                OpsAlertEvent.org_id == "org-summary",
                OpsAlertEvent.event_type == AlertEventType.DAILY_SUMMARY.value,
                OpsAlertEvent.recipient_phone.is_(None),
            )
            .first()
        )
        assert summary_row is not None
        assert summary_row.is_summary is True


def test_billing_webhook_records_signature_failures(monkeypatch):
    monkeypatch.setenv("RAZORPAY_WEBHOOK_SECRET", "secret")
    captured: list[tuple[str, str]] = []
    monkeypatch.setattr(billing_router, "record_payment_webhook_error", lambda **kwargs: captured.append((kwargs["kind"], kwargs["error_message"])))
    fake_razorpay = SimpleNamespace(
        Utility=SimpleNamespace(
            verify_webhook_signature=lambda payload, signature, secret: (_ for _ in ()).throw(RuntimeError("bad signature"))
        )
    )
    monkeypatch.setitem(sys.modules, "razorpay", fake_razorpay)

    with TestClient(app) as client:
        response = client.post(
            "/billing/webhook/razorpay",
            content='{"event":"payment.failed"}',
            headers={"x-razorpay-signature": "bad"},
        )

    assert response.status_code == 400
    assert captured == [("signature_verification", "bad signature")]


def test_ocr_worker_records_final_failures(monkeypatch, tmp_path):
    captured: list[tuple[str, str, str | None, int | None, int | None]] = []
    monkeypatch.setattr(ocr_jobs, "JOB_DIR", tmp_path)
    monkeypatch.setattr(ocr_jobs, "_queue", queue.Queue())
    monkeypatch.setattr(ocr_jobs, "_jobs", {})
    monkeypatch.setattr(
        ocr_jobs,
        "record_ocr_failure",
        lambda job_id, error, org_id=None, attempts=None, max_attempts=None: captured.append((job_id, error, org_id, attempts, max_attempts)),
    )
    monkeypatch.setattr(ocr_jobs, "_process_ledger", lambda job: (_ for _ in ()).throw(RuntimeError("ocr timeout")))

    job = enqueue_job("ledger", b"test-image", params={})
    job.max_attempts = 1
    ocr_jobs._queue.put_nowait(None)

    ocr_jobs._worker_loop()

    assert ocr_jobs.get_job(job.job_id).status == "failed"
    assert captured
    assert captured[0][0] == job.job_id
