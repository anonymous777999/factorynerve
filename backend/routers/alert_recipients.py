"""Admin-only WhatsApp alert recipient management."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.admin_alert_recipient import AdminAlertRecipient
from backend.models.phone_verification import PhoneVerificationChannel, PhoneVerificationStatus
from backend.models.report import AuditLog
from backend.models.user import User, UserRole
from backend.middleware.rate_limit_middleware import extract_client_ip
from backend.rbac import require_any_role
from backend.schemas.phone_verification import (
    PhoneVerificationConfirmRequest,
    PhoneVerificationConfirmResponse,
    PhoneVerificationStartRequest,
    PhoneVerificationStartResponse,
)
from backend.security import get_current_user
from backend.services.ops_alerts.recipients import (
    count_active_alert_recipients,
    get_alert_recipient_limit,
    list_alert_recipients,
    normalize_alert_phone_number,
    normalize_event_type_preferences,
    normalize_severity_level_preferences,
    preference_state,
    validate_alert_recipient_user,
)
from backend.tenancy import resolve_org_id
from backend.services.otp_service import (
    ExpiredOTPError,
    InvalidOTPError,
    MaxAttemptsExceededError,
    NoActiveOTPError,
    OTPService,
    RateLimitedError,
    SMSDeliveryFailedError,
)
from backend.services.sms_service import build_sms_provider


router = APIRouter(tags=["Settings"])


class AlertRecipientCreateRequest(BaseModel):
    phone_number: str = Field(min_length=7, max_length=32)
    user_id: int | None = None
    event_types: list[str] | None = None
    severity_levels: list[str] | None = None
    receive_daily_summary: bool = True
    is_active: bool = True


class AlertRecipientUpdateRequest(BaseModel):
    phone_number: str | None = Field(default=None, min_length=7, max_length=32)
    user_id: int | None = None
    event_types: list[str] | None = None
    severity_levels: list[str] | None = None
    receive_daily_summary: bool | None = None
    is_active: bool | None = None


class AlertRecipientResponse(BaseModel):
    id: int
    user_id: int | None
    phone_number: str
    phone_e164: str | None
    verification_status: str
    verified_at: datetime | None
    event_types: list[str] | None
    event_types_mode: str
    severity_levels: list[str] | None
    severity_levels_mode: str
    receive_daily_summary: bool
    is_active: bool
    created_at: datetime


class AlertRecipientListResponse(BaseModel):
    recipients: list[AlertRecipientResponse]
    active_count: int
    limit: int
    plan: str
    preference_rules: dict[str, str]


def _require_alert_admin(current_user: User) -> None:
    require_any_role(current_user, {UserRole.ADMIN, UserRole.OWNER})


def _current_org_id(current_user: User) -> str:
    org_id = resolve_org_id(current_user)
    if not org_id:
        raise HTTPException(status_code=400, detail="Organization could not be resolved.")
    return org_id


def _serialize_recipient(row: AdminAlertRecipient) -> AlertRecipientResponse:
    event_type_state = preference_state(row.event_types)
    severity_state = preference_state(row.severity_levels)
    return AlertRecipientResponse(
        id=row.id,
        user_id=row.user_id,
        phone_number=row.phone_number,
        phone_e164=row.phone_e164,
        verification_status=row.verification_status,
        verified_at=row.verified_at,
        event_types=row.event_types,
        event_types_mode=event_type_state.mode,
        severity_levels=row.severity_levels,
        severity_levels_mode=severity_state.mode,
        receive_daily_summary=row.receive_daily_summary,
        is_active=row.is_active,
        created_at=row.created_at,
    )


def _write_audit(
    db: Session,
    *,
    current_user: User,
    request: Request,
    action: str,
    details: str,
    org_id: str,
) -> None:
    ip_address = request.client.host if request.client else None
    db.add(
        AuditLog(
            user_id=current_user.id,
            org_id=org_id,
            factory_id=getattr(current_user, "active_factory_id", None),
            action=action,
            details=details,
            ip_address=ip_address,
            user_agent=request.headers.get("user-agent"),
            timestamp=datetime.now(timezone.utc),
        )
    )


def _recipient_or_404(db: Session, *, org_id: str, recipient_id: int) -> AdminAlertRecipient:
    row = (
        db.query(AdminAlertRecipient)
        .filter(
            AdminAlertRecipient.id == recipient_id,
            AdminAlertRecipient.org_id == org_id,
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Alert recipient not found.")
    return row


def _recipient_has_verified_route(db: Session, row: AdminAlertRecipient) -> bool:
    if row.user_id is not None:
        user = (
            db.query(User)
            .filter(User.id == row.user_id, User.org_id == row.org_id, User.is_active.is_(True))
            .first()
        )
        if user and user.phone_e164 and user.phone_verification_status == PhoneVerificationStatus.VERIFIED:
            return True
    return bool(row.phone_e164 and row.verification_status == PhoneVerificationStatus.VERIFIED.value)


def _linked_verified_user(db: Session, *, org_id: str, user_id: int | None) -> User | None:
    if user_id is None:
        return None
    user = (
        db.query(User)
        .filter(User.id == user_id, User.org_id == org_id, User.is_active.is_(True))
        .first()
    )
    if user and user.phone_e164 and user.phone_verification_status == PhoneVerificationStatus.VERIFIED:
        return user
    return None


def get_otp_service() -> OTPService:
    return OTPService(sms_provider=build_sms_provider())


@router.get("/alert-recipients", response_model=AlertRecipientListResponse)
def get_alert_recipients(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AlertRecipientListResponse:
    _require_alert_admin(current_user)
    org_id = _current_org_id(current_user)
    recipients = list_alert_recipients(db, org_id=org_id)
    plan, limit = get_alert_recipient_limit(db, org_id=org_id, fallback_user_id=current_user.id)
    active_count = count_active_alert_recipients(db, org_id=org_id)
    return AlertRecipientListResponse(
        recipients=[_serialize_recipient(row) for row in recipients],
        active_count=active_count,
        limit=limit,
        plan=plan,
        preference_rules={
            "event_types": "missing means all event types are allowed; empty list means no event types are allowed.",
            "severity_levels": "missing means all severity levels are allowed; empty list means no severity levels are allowed.",
        },
    )


@router.post("/alert-recipients", response_model=AlertRecipientResponse, status_code=status.HTTP_201_CREATED)
def create_alert_recipient(
    payload: AlertRecipientCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AlertRecipientResponse:
    _require_alert_admin(current_user)
    org_id = _current_org_id(current_user)
    try:
        phone_number = normalize_alert_phone_number(payload.phone_number)
        event_types = normalize_event_type_preferences(payload.event_types)
        severity_levels = normalize_severity_level_preferences(payload.severity_levels)
        linked_user = None
        if payload.user_id is not None:
            validate_alert_recipient_user(db, org_id=org_id, user_id=payload.user_id)
            linked_user = _linked_verified_user(db, org_id=org_id, user_id=payload.user_id)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    plan, limit = get_alert_recipient_limit(db, org_id=org_id, fallback_user_id=current_user.id)
    active_count = count_active_alert_recipients(db, org_id=org_id)
    if payload.is_active and active_count >= limit:
        raise HTTPException(
            status_code=403,
            detail=f"Alert recipient limit reached for the {plan.title()} plan. Max active recipients: {limit}.",
        )
    row = AdminAlertRecipient(
        org_id=org_id,
        user_id=payload.user_id,
        phone_number=linked_user.phone_e164 if linked_user else phone_number,
        phone_e164=linked_user.phone_e164 if linked_user else phone_number,
        verification_status=PhoneVerificationStatus.VERIFIED.value if linked_user else PhoneVerificationStatus.PENDING.value,
        verified_at=linked_user.phone_verified_at if linked_user else None,
        verified_by_user_id=current_user.id if linked_user else None,
        event_types=event_types,
        severity_levels=severity_levels,
        receive_daily_summary=payload.receive_daily_summary,
        is_active=payload.is_active,
    )
    if row.is_active and not _recipient_has_verified_route(db, row):
        raise HTTPException(status_code=403, detail="Recipient phone must be verified before activation.")
    db.add(row)
    _write_audit(
        db,
        current_user=current_user,
        request=request,
        action="alert_recipient_created",
        details=(
            f"phone={phone_number} active={payload.is_active} daily_summary={payload.receive_daily_summary} "
            f"event_types={event_types if event_types is not None else 'ALL'} "
            f"severity_levels={severity_levels if severity_levels is not None else 'ALL'}"
        ),
        org_id=org_id,
    )
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="Phone number already exists for this account.") from error
    db.refresh(row)
    return _serialize_recipient(row)


@router.patch("/alert-recipients/{recipient_id}", response_model=AlertRecipientResponse)
def update_alert_recipient(
    recipient_id: int,
    payload: AlertRecipientUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AlertRecipientResponse:
    _require_alert_admin(current_user)
    org_id = _current_org_id(current_user)
    row = _recipient_or_404(db, org_id=org_id, recipient_id=recipient_id)
    if payload.phone_number is not None:
        try:
            normalized_phone = normalize_alert_phone_number(payload.phone_number)
        except ValueError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error
        if normalized_phone != row.phone_e164:
            row.phone_number = normalized_phone
            row.phone_e164 = normalized_phone
            row.verification_status = PhoneVerificationStatus.PENDING.value
            row.verified_at = None
            row.verified_by_user_id = None
            row.otp_attempts = 0
            row.last_otp_sent_at = None
            row.is_active = False
    if payload.event_types is not None:
        try:
            row.event_types = normalize_event_type_preferences(payload.event_types)
        except ValueError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error
    if payload.severity_levels is not None:
        try:
            row.severity_levels = normalize_severity_level_preferences(payload.severity_levels)
        except ValueError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error
    if payload.user_id is not None:
        try:
            validate_alert_recipient_user(db, org_id=org_id, user_id=payload.user_id)
        except ValueError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error
        row.user_id = payload.user_id
        linked_user = _linked_verified_user(db, org_id=org_id, user_id=payload.user_id)
        if linked_user is not None:
            row.phone_number = linked_user.phone_e164
            row.phone_e164 = linked_user.phone_e164
            row.verification_status = PhoneVerificationStatus.VERIFIED.value
            row.verified_at = linked_user.phone_verified_at
            row.verified_by_user_id = current_user.id
            row.otp_attempts = 0
            row.last_otp_sent_at = None
        if row.is_active and not _recipient_has_verified_route(db, row):
            row.is_active = False
    if payload.is_active is not None and payload.is_active and not row.is_active:
        plan, limit = get_alert_recipient_limit(db, org_id=org_id, fallback_user_id=current_user.id)
        active_count = count_active_alert_recipients(db, org_id=org_id)
        if active_count >= limit:
            raise HTTPException(
                status_code=403,
                detail=f"Alert recipient limit reached for the {plan.title()} plan. Max active recipients: {limit}.",
            )
        if not _recipient_has_verified_route(db, row):
            raise HTTPException(status_code=403, detail="Recipient phone must be verified before activation.")
    if payload.is_active is not None:
        row.is_active = payload.is_active
    if payload.receive_daily_summary is not None:
        row.receive_daily_summary = payload.receive_daily_summary
    _write_audit(
        db,
        current_user=current_user,
        request=request,
        action="alert_recipient_updated",
        details=(
            f"recipient_id={row.id} active={row.is_active} daily_summary={row.receive_daily_summary} "
            f"event_types={row.event_types if row.event_types is not None else 'ALL'} "
            f"severity_levels={row.severity_levels if row.severity_levels is not None else 'ALL'}"
        ),
        org_id=org_id,
    )
    try:
        db.add(row)
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="Phone number already exists for this account.") from error
    db.refresh(row)
    return _serialize_recipient(row)


@router.post("/alert-recipients/{recipient_id}/start-verification", response_model=PhoneVerificationStartResponse)
def start_alert_recipient_verification(
    recipient_id: int,
    payload: PhoneVerificationStartRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    otp_service: OTPService = Depends(get_otp_service),
) -> PhoneVerificationStartResponse:
    _require_alert_admin(current_user)
    org_id = _current_org_id(current_user)
    row = _recipient_or_404(db, org_id=org_id, recipient_id=recipient_id)
    try:
        result = otp_service.start_recipient_verification(
            db,
            recipient=row,
            actor=current_user,
            phone_e164=payload.phone,
            ip_address=extract_client_ip(request),
            channel=PhoneVerificationChannel.SMS,
        )
        return PhoneVerificationStartResponse(masked_phone=result.masked_phone, expires_in=result.expires_in)
    except RateLimitedError as error:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"code": error.code, "message": error.message, "retry_after": error.retry_after},
        ) from error
    except SMSDeliveryFailedError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": error.code, "message": error.message},
        ) from error
    except RuntimeError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error


@router.post("/alert-recipients/{recipient_id}/confirm-verification", response_model=PhoneVerificationConfirmResponse)
def confirm_alert_recipient_verification(
    recipient_id: int,
    payload: PhoneVerificationConfirmRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    otp_service: OTPService = Depends(get_otp_service),
) -> PhoneVerificationConfirmResponse:
    _require_alert_admin(current_user)
    org_id = _current_org_id(current_user)
    row = _recipient_or_404(db, org_id=org_id, recipient_id=recipient_id)
    try:
        result = otp_service.confirm_recipient_verification(
            db,
            recipient=row,
            actor=current_user,
            phone_e164=payload.phone,
            otp_code=payload.otp,
            channel=PhoneVerificationChannel.SMS,
        )
        return PhoneVerificationConfirmResponse(verified=result.verified, phone_e164=result.phone_e164)
    except NoActiveOTPError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": error.code, "message": error.message}) from error
    except ExpiredOTPError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"code": error.code, "message": error.message}) from error
    except MaxAttemptsExceededError as error:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"code": error.code, "message": error.message},
        ) from error
    except InvalidOTPError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": error.code,
                "message": error.message,
                "attempts_remaining": error.attempts_remaining,
            },
        ) from error


@router.delete("/alert-recipients/{recipient_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_alert_recipient(
    recipient_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    _require_alert_admin(current_user)
    org_id = _current_org_id(current_user)
    row = _recipient_or_404(db, org_id=org_id, recipient_id=recipient_id)
    _write_audit(
        db,
        current_user=current_user,
        request=request,
        action="alert_recipient_deleted",
        details=f"recipient_id={row.id} phone={row.phone_number}",
        org_id=org_id,
    )
    db.delete(row)
    db.commit()
