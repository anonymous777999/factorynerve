from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import fakeredis
import pytest
try:
    from redis.exceptions import ConnectionError as RedisConnectionError
except Exception:  # pragma: no cover - optional dependency fallback
    class RedisConnectionError(Exception):
        pass

from backend.database import SessionLocal, init_db
from backend.models.admin_alert_recipient import AdminAlertRecipient
from backend.models.organization import Organization
from backend.models.phone_verification import (
    PhoneVerification,
    PhoneVerificationChannel,
    PhoneVerificationPurpose,
    PhoneVerificationStatus,
)
from backend.models.user import User, UserRole
from backend.services.otp_service import (
    ExpiredOTPError,
    InvalidOTPError,
    MaxAttemptsExceededError,
    NoActiveOTPError,
    OTPService,
    RateLimitedError,
    SMSDeliveryFailedError,
)
from backend.services.rate_limit_service import InMemoryRateLimitService, RateLimitService, build_otp_rate_limit_service
from backend.services.sms_service import MockSMSProvider, SMSResult, WhatsAppSMSProvider, build_sms_provider


def _build_service(provider: MockSMSProvider | None = None) -> tuple[OTPService, MockSMSProvider]:
    sms_provider = provider or MockSMSProvider()
    fake_redis = fakeredis.FakeStrictRedis(decode_responses=True)
    service = OTPService(
        sms_provider=sms_provider,
        rate_limits=RateLimitService(client=fake_redis),
    )
    return service, sms_provider


class BrokenRedisClient:
    def get(self, key: str):
        raise RedisConnectionError(f"redis get failed for {key}")

    def ttl(self, key: str):
        raise RedisConnectionError(f"redis ttl failed for {key}")

    def pipeline(self):
        raise RedisConnectionError("redis pipeline failed")

    def set(self, key: str, value: str, ex: int | None = None):
        raise RedisConnectionError(f"redis set failed for {key}")


def _create_user(*, phone: str = "+919876543210") -> User:
    init_db()
    with SessionLocal() as db:
        org = Organization(org_id=str(uuid4()), name=f"OTP Org {uuid4().hex[:6]}", plan="pilot")
        db.add(org)
        db.commit()
        user = User(
            org_id=org.org_id,
            user_code=10000 + int(uuid4().hex[:4], 16),
            name="OTP User",
            email=f"otp_{uuid4().hex[:8]}@example.com",
            password_hash="hash",
            role=UserRole.ADMIN,
            factory_name="OTP Factory",
            phone_number=phone,
            phone_e164=phone,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user


def _create_recipient(*, org_id: str, phone: str = "+919876543211") -> AdminAlertRecipient:
    with SessionLocal() as db:
        recipient = AdminAlertRecipient(
            org_id=org_id,
            phone_number=phone,
            phone_e164=phone,
            verification_status=PhoneVerificationStatus.PENDING.value,
            is_active=False,
        )
        db.add(recipient)
        db.commit()
        db.refresh(recipient)
        return recipient


def test_valid_otp_verifies_and_marks_used():
    service, provider = _build_service()
    user = _create_user()

    with SessionLocal() as db:
        db_user = db.query(User).filter(User.id == user.id).first()
        assert db_user is not None
        started = service.start_user_verification(
            db,
            user=db_user,
            phone_e164="+919876543210",
            ip_address="127.0.0.1",
            channel=PhoneVerificationChannel.WHATSAPP,
        )
        otp_code = provider.sent["+919876543210"]
        confirmed = service.confirm_user_verification(
            db,
            user=db_user,
            phone_e164="+919876543210",
            otp_code=otp_code,
            channel=PhoneVerificationChannel.WHATSAPP,
        )
        verification = (
            db.query(PhoneVerification)
            .filter(PhoneVerification.id == started.verification_id)
            .first()
        )
        db.refresh(db_user)

    assert confirmed.verified is True
    assert verification is not None
    assert verification.used is True
    assert db_user.phone_verification_status == PhoneVerificationStatus.VERIFIED


def test_expired_otp_returns_error():
    service, provider = _build_service()
    user = _create_user(phone="+919876543212")

    with SessionLocal() as db:
        db_user = db.query(User).filter(User.id == user.id).first()
        assert db_user is not None
        started = service.start_user_verification(
            db,
            user=db_user,
            phone_e164="+919876543212",
            ip_address="127.0.0.2",
            channel=PhoneVerificationChannel.WHATSAPP,
        )
        verification = db.query(PhoneVerification).filter(PhoneVerification.id == started.verification_id).first()
        assert verification is not None
        verification.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
        db.add(verification)
        db.commit()
        with pytest.raises(ExpiredOTPError):
            service.confirm_user_verification(
                db,
                user=db_user,
                phone_e164="+919876543212",
                otp_code=provider.sent["+919876543212"],
                channel=PhoneVerificationChannel.WHATSAPP,
            )


def test_wrong_otp_increments_attempt_counter():
    service, _provider = _build_service()
    user = _create_user(phone="+919876543213")

    with SessionLocal() as db:
        db_user = db.query(User).filter(User.id == user.id).first()
        assert db_user is not None
        started = service.start_user_verification(
            db,
            user=db_user,
            phone_e164="+919876543213",
            ip_address="127.0.0.3",
            channel=PhoneVerificationChannel.WHATSAPP,
        )
        with pytest.raises(InvalidOTPError):
            service.confirm_user_verification(
                db,
                user=db_user,
                phone_e164="+919876543213",
                otp_code="000000",
                channel=PhoneVerificationChannel.WHATSAPP,
            )
        verification = db.query(PhoneVerification).filter(PhoneVerification.id == started.verification_id).first()

    assert verification is not None
    assert verification.attempts == 1


def test_reused_otp_returns_no_active_code():
    service, provider = _build_service()
    user = _create_user(phone="+919876543214")

    with SessionLocal() as db:
        db_user = db.query(User).filter(User.id == user.id).first()
        assert db_user is not None
        service.start_user_verification(
            db,
            user=db_user,
            phone_e164="+919876543214",
            ip_address="127.0.0.4",
            channel=PhoneVerificationChannel.WHATSAPP,
        )
        otp_code = provider.sent["+919876543214"]
        service.confirm_user_verification(
            db,
            user=db_user,
            phone_e164="+919876543214",
            otp_code=otp_code,
            channel=PhoneVerificationChannel.WHATSAPP,
        )
        with pytest.raises(NoActiveOTPError):
            service.confirm_user_verification(
                db,
                user=db_user,
                phone_e164="+919876543214",
                otp_code=otp_code,
                channel=PhoneVerificationChannel.WHATSAPP,
            )


def test_otp_locks_after_max_failed_attempts():
    service, _provider = _build_service()
    user = _create_user(phone="+919876543215")

    with SessionLocal() as db:
        db_user = db.query(User).filter(User.id == user.id).first()
        assert db_user is not None
        service.start_user_verification(
            db,
            user=db_user,
            phone_e164="+919876543215",
            ip_address="127.0.0.5",
            channel=PhoneVerificationChannel.WHATSAPP,
        )
        for _ in range(5):
            with pytest.raises(InvalidOTPError):
                service.confirm_user_verification(
                    db,
                    user=db_user,
                    phone_e164="+919876543215",
                    otp_code="111111",
                    channel=PhoneVerificationChannel.WHATSAPP,
                )
        with pytest.raises(MaxAttemptsExceededError):
            service.confirm_user_verification(
                db,
                user=db_user,
                phone_e164="+919876543215",
                otp_code="111111",
                    channel=PhoneVerificationChannel.WHATSAPP,
            )


def test_new_otp_invalidates_prior_active_otp():
    service, provider = _build_service()
    user = _create_user(phone="+919876543216")

    with SessionLocal() as db:
        db_user = db.query(User).filter(User.id == user.id).first()
        assert db_user is not None
        first = service.start_user_verification(
            db,
            user=db_user,
            phone_e164="+919876543216",
            ip_address="127.0.0.6",
            channel=PhoneVerificationChannel.WHATSAPP,
        )
        rate_limit = service._rate_limits  # noqa: SLF001
        phone_key = rate_limit._phone_send_key("+919876543216")  # noqa: SLF001
        ip_key = rate_limit._ip_send_key("127.0.0.6")  # noqa: SLF001
        cooldown_key = rate_limit._cooldown_key("+919876543216")  # noqa: SLF001
        rate_limit._client.delete(phone_key)  # noqa: SLF001
        rate_limit._client.delete(ip_key)  # noqa: SLF001
        rate_limit._client.delete(cooldown_key)  # noqa: SLF001
        second = service.start_user_verification(
            db,
            user=db_user,
            phone_e164="+919876543216",
            ip_address="127.0.0.6",
            channel=PhoneVerificationChannel.WHATSAPP,
        )

        first_record = db.query(PhoneVerification).filter(PhoneVerification.id == first.verification_id).first()
        second_record = db.query(PhoneVerification).filter(PhoneVerification.id == second.verification_id).first()

    assert first_record is not None and first_record.used is True
    assert second_record is not None and second_record.used is False


def test_otp_service_falls_back_to_in_memory_rate_limits_without_redis(monkeypatch):
    monkeypatch.setattr("backend.services.rate_limit_service.get_redis_client", lambda: None)
    limiter = build_otp_rate_limit_service()

    assert isinstance(limiter, InMemoryRateLimitService)


def test_unknown_sms_provider_returns_controlled_failure(monkeypatch):
    monkeypatch.setenv("SMS_PROVIDER", "does-not-exist")
    provider = build_sms_provider()
    result = provider.send_otp("+919876543299", "123456", "whatsapp")

    assert result.success is False
    assert result.provider == "does-not-exist"
    assert "unsupported otp delivery provider" in (result.error or "").lower()


def test_build_sms_provider_defaults_to_whatsapp_when_meta_mode_enabled(monkeypatch):
    monkeypatch.delenv("SMS_PROVIDER", raising=False)
    monkeypatch.setenv("WHATSAPP_PROVIDER_MODE", "meta")

    provider = build_sms_provider()

    assert isinstance(provider, WhatsAppSMSProvider)


def test_whatsapp_sms_provider_uses_existing_sender(monkeypatch):
    captured: dict[str, object] = {}

    def fake_send_message_blocking(*, to: str, template_name: str, template_params: dict, org_id: str, timeout_seconds=None):
        captured["to"] = to
        captured["template_name"] = template_name
        captured["template_params"] = template_params
        captured["org_id"] = org_id
        captured["timeout_seconds"] = timeout_seconds
        return type(
            "FakeMessageResult",
            (),
            {
                "provider_message_id": "wamid.otp.123",
                "status": "sent",
                "provider_response": {"provider": "meta", "http_status": 200},
                "error_message": None,
                "attempt_count": 1,
            },
        )()

    monkeypatch.setattr("backend.services.sms_service.whatsapp_sender.send_message_blocking", fake_send_message_blocking)
    provider = WhatsAppSMSProvider()

    result = provider.send_otp("+919876543277", "123456", "whatsapp")

    assert result.success is True
    assert result.provider == "meta_whatsapp"
    assert captured["to"] == "+919876543277"
    assert captured["template_name"] == "otp_verification_code"
    assert captured["org_id"] == "otp-verification"
    assert captured["template_params"] == {
        "auth_template": True,
        "code": "123456",
        "expires_minutes": 5,
        "disable_dedup": True,
    }


def test_whatsapp_sms_provider_maps_invalid_phone_to_client_error(monkeypatch):
    def fake_send_message_blocking(*, to: str, template_name: str, template_params: dict, org_id: str, timeout_seconds=None):
        return type(
            "FakeMessageResult",
            (),
            {
                "provider_message_id": None,
                "status": "failed",
                "provider_response": {"provider": "meta", "reason": "invalid_phone", "http_status": 400},
                "error_message": "Phone number must be a valid E.164 number.",
                "attempt_count": 0,
            },
        )()

    monkeypatch.setattr("backend.services.sms_service.whatsapp_sender.send_message_blocking", fake_send_message_blocking)
    provider = WhatsAppSMSProvider()

    result = provider.send_otp("+919876543278", "123456", "whatsapp")

    assert result.success is False
    assert result.status_code == 400
    assert result.retryable is False
    assert "whatsapp verification codes" in (result.error or "").lower()


def test_whatsapp_sms_provider_masks_logging(monkeypatch):
    events: list[tuple[str, str, dict[str, object]]] = []

    class LoggerSpy:
        def info(self, event: str, **kwargs):
            events.append(("info", event, kwargs))

        def warning(self, event: str, **kwargs):
            events.append(("warning", event, kwargs))

    def fake_send_message_blocking(*, to: str, template_name: str, template_params: dict, org_id: str, timeout_seconds=None):
        return type(
            "FakeMessageResult",
            (),
            {
                "provider_message_id": None,
                "status": "failed",
                "provider_response": {"provider": "meta", "reason": "config_missing", "http_status": 400},
                "error_message": "Token expired",
                "attempt_count": 0,
            },
        )()

    monkeypatch.setattr("backend.services.sms_service.whatsapp_sender.send_message_blocking", fake_send_message_blocking)
    monkeypatch.setattr("backend.services.sms_service.logger", LoggerSpy())
    provider = WhatsAppSMSProvider()

    provider.send_otp("+919876543279", "654321", "whatsapp")

    assert events
    payload = events[-1][2]
    assert payload["phone_masked"] != "+919876543279"
    assert "654321" not in str(payload)
    assert "+919876543279" not in str(payload)


def test_otp_service_raises_delivery_failure_for_provider_error():
    class FailingProvider:
        def send_otp(self, phone_e164: str, otp: str, channel: str) -> SMSResult:
            return SMSResult(
                success=False,
                provider="meta_whatsapp",
                error="Verification code delivery is temporarily unavailable. Please try again.",
                status_code=503,
                retryable=True,
            )

    fake_redis = fakeredis.FakeStrictRedis(decode_responses=True)
    service = OTPService(
        sms_provider=FailingProvider(),
        rate_limits=RateLimitService(client=fake_redis),
    )
    user = _create_user(phone="+919876543280")

    with SessionLocal() as db:
        db_user = db.query(User).filter(User.id == user.id).first()
        assert db_user is not None
        with pytest.raises(SMSDeliveryFailedError) as error:
            service.start_user_verification(
                db,
                user=db_user,
                phone_e164="+919876543280",
                ip_address="127.0.0.8",
                channel=PhoneVerificationChannel.WHATSAPP,
            )

    assert error.value.result.status_code == 503


def test_otp_service_falls_back_when_redis_rate_limit_runtime_fails():
    provider = MockSMSProvider()
    service = OTPService(
        sms_provider=provider,
        rate_limits=RateLimitService(client=BrokenRedisClient()),
    )
    user = _create_user(phone="+919876543281")

    with SessionLocal() as db:
        db_user = db.query(User).filter(User.id == user.id).first()
        assert db_user is not None
        result = service.start_user_verification(
            db,
            user=db_user,
            phone_e164="+919876543281",
            ip_address="127.0.0.9",
            channel=PhoneVerificationChannel.WHATSAPP,
        )

    assert result.masked_phone
    assert provider.sent["+919876543281"]


def test_otp_cooldown_still_applies_when_redis_runtime_fails():
    provider = MockSMSProvider()
    service = OTPService(
        sms_provider=provider,
        rate_limits=RateLimitService(client=BrokenRedisClient()),
    )
    user = _create_user(phone="+919876543282")

    with SessionLocal() as db:
        db_user = db.query(User).filter(User.id == user.id).first()
        assert db_user is not None
        service.start_user_verification(
            db,
            user=db_user,
            phone_e164="+919876543282",
            ip_address="127.0.0.10",
            channel=PhoneVerificationChannel.WHATSAPP,
        )
        with pytest.raises(RateLimitedError) as error:
            service.start_user_verification(
                db,
                user=db_user,
                phone_e164="+919876543282",
                ip_address="127.0.0.10",
                channel=PhoneVerificationChannel.WHATSAPP,
            )

    assert "Please wait before requesting another code." in str(error.value)
