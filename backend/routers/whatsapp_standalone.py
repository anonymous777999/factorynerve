"""Standalone WhatsApp alert router with plug-and-play recipient management."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy.orm import Session, selectinload

from backend.database import SessionLocal, get_db
from backend.models.alert_log import AlertLog, AlertLogStatus
from backend.models.alert_preference import AlertPreference
from backend.models.alert_recipient import AlertRecipient
from backend.phone_utils import normalize_phone_e164
from backend.services.whatsapp_sender import WhatsAppSender, WhatsAppSenderError, build_whatsapp_sender, send_with_retries


router = APIRouter(tags=["WhatsApp Alerts"])
DEFAULT_ALERT_TYPE = "*"


class RecipientCreateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    phone_e164: str = Field(min_length=7, max_length=20)
    is_active: bool = True
    alert_types: list[str] | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Recipient name is required.")
        return cleaned

    @field_validator("alert_types")
    @classmethod
    def validate_alert_types(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        cleaned: list[str] = []
        seen: set[str] = set()
        for item in value:
            alert_type = item.strip().lower()
            if not alert_type:
                raise ValueError("Alert types cannot contain empty values.")
            if alert_type in seen:
                continue
            seen.add(alert_type)
            cleaned.append(alert_type)
        return cleaned


class RecipientToggleRequest(BaseModel):
    is_active: bool


class AlertPreferenceResponse(BaseModel):
    id: int
    alert_type: str
    enabled: bool

    model_config = ConfigDict(from_attributes=True)


class RecipientResponse(BaseModel):
    id: int
    name: str
    phone_e164: str
    is_active: bool
    created_at: datetime
    preferences: list[AlertPreferenceResponse]

    model_config = ConfigDict(from_attributes=True)


class SendAlertRequest(BaseModel):
    alert_type: str = Field(min_length=1, max_length=80)
    message: str = Field(min_length=1, max_length=4000)

    @field_validator("alert_type")
    @classmethod
    def validate_alert_type(cls, value: str) -> str:
        cleaned = value.strip().lower()
        if not cleaned:
            raise ValueError("Alert type is required.")
        return cleaned

    @field_validator("message")
    @classmethod
    def validate_message(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Message is required.")
        return cleaned


class SendAlertResponse(BaseModel):
    alert_type: str
    message: str
    matched_recipients: int
    queued_logs: int
    status: str


def get_whatsapp_sender() -> WhatsAppSender:
    return build_whatsapp_sender()


def _serialize_recipient(recipient: AlertRecipient) -> RecipientResponse:
    return RecipientResponse(
        id=recipient.id,
        name=recipient.name,
        phone_e164=recipient.phone_e164,
        is_active=recipient.is_active,
        created_at=recipient.created_at,
        preferences=sorted(recipient.preferences, key=lambda row: row.alert_type),
    )


def _recipient_matches_alert_type(recipient: AlertRecipient, alert_type: str) -> bool:
    if not recipient.preferences:
        return False
    preference_map = {preference.alert_type.lower(): preference.enabled for preference in recipient.preferences}
    if alert_type in preference_map:
        return preference_map[alert_type]
    return preference_map.get(DEFAULT_ALERT_TYPE, False)


async def _dispatch_alert_logs(*, log_ids: list[int], sender: WhatsAppSender) -> None:
    if not log_ids:
        return
    with SessionLocal() as db:
        logs = (
            db.query(AlertLog)
            .options(selectinload(AlertLog.recipient))
            .filter(AlertLog.id.in_(log_ids))
            .all()
        )
        for log_row in logs:
            recipient = log_row.recipient
            if recipient is None or not recipient.is_active:
                log_row.status = AlertLogStatus.FAILED
                log_row.failure_reason = "Recipient is inactive or unavailable."
                log_row.provider_response = {"error": log_row.failure_reason}
                log_row.updated_at = datetime.now(timezone.utc)
                db.add(log_row)
                continue
            result = await send_with_retries(recipient.phone_e164, log_row.message, sender=sender)
            log_row.provider = result.provider
            log_row.provider_message_id = result.provider_message_id
            log_row.provider_response = result.response_data
            log_row.failure_reason = result.error
            log_row.attempt_count = max(1, result.attempts_made)
            log_row.updated_at = datetime.now(timezone.utc)
            log_row.status = AlertLogStatus.SENT if result.success else AlertLogStatus.FAILED
            db.add(log_row)
        db.commit()


@router.post("/recipients", response_model=RecipientResponse, status_code=status.HTTP_201_CREATED)
def create_recipient(
    payload: RecipientCreateRequest,
    db: Session = Depends(get_db),
) -> RecipientResponse:
    phone_e164 = normalize_phone_e164(payload.phone_e164)
    existing = db.query(AlertRecipient).filter(AlertRecipient.phone_e164 == phone_e164).first()
    if existing:
        raise HTTPException(status_code=409, detail="Recipient already exists for this phone number.")

    recipient = AlertRecipient(
        name=(payload.name or phone_e164).strip(),
        phone_e164=phone_e164,
        is_active=payload.is_active,
    )
    db.add(recipient)
    db.flush()
    for alert_type in payload.alert_types or [DEFAULT_ALERT_TYPE]:
        db.add(AlertPreference(recipient_id=recipient.id, alert_type=alert_type, enabled=True))
    db.commit()
    recipient = (
        db.query(AlertRecipient)
        .options(selectinload(AlertRecipient.preferences))
        .filter(AlertRecipient.id == recipient.id)
        .first()
    )
    assert recipient is not None
    return _serialize_recipient(recipient)


@router.get("/recipients", response_model=list[RecipientResponse])
def list_recipients(
    db: Session = Depends(get_db),
) -> list[RecipientResponse]:
    recipients = (
        db.query(AlertRecipient)
        .options(selectinload(AlertRecipient.preferences))
        .order_by(AlertRecipient.created_at.desc(), AlertRecipient.id.desc())
        .all()
    )
    return [_serialize_recipient(row) for row in recipients]


@router.patch("/recipients/{recipient_id}", response_model=RecipientResponse)
def update_recipient(
    recipient_id: int,
    payload: RecipientToggleRequest,
    db: Session = Depends(get_db),
) -> RecipientResponse:
    recipient = (
        db.query(AlertRecipient)
        .options(selectinload(AlertRecipient.preferences))
        .filter(AlertRecipient.id == recipient_id)
        .first()
    )
    if recipient is None:
        raise HTTPException(status_code=404, detail="Recipient not found.")
    recipient.is_active = payload.is_active
    db.add(recipient)
    db.commit()
    db.refresh(recipient)
    return _serialize_recipient(recipient)


@router.post("/alerts/send", response_model=SendAlertResponse, status_code=status.HTTP_202_ACCEPTED)
def send_alert(
    payload: SendAlertRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    sender: WhatsAppSender = Depends(get_whatsapp_sender),
) -> SendAlertResponse:
    try:
        sender.validate_config()
    except WhatsAppSenderError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error

    recipients = (
        db.query(AlertRecipient)
        .options(selectinload(AlertRecipient.preferences))
        .filter(AlertRecipient.is_active.is_(True))
        .all()
    )
    targets = [row for row in recipients if _recipient_matches_alert_type(row, payload.alert_type)]
    now = datetime.now(timezone.utc)
    log_ids: list[int] = []
    for recipient in targets:
        log_row = AlertLog(
            recipient_id=recipient.id,
            alert_type=payload.alert_type,
            message=payload.message,
            status=AlertLogStatus.PENDING,
            provider_response={
                "status": "queued",
                "queued_at": now.isoformat(),
                "alert_type": payload.alert_type,
            },
            created_at=now,
            updated_at=now,
        )
        db.add(log_row)
        db.flush()
        log_ids.append(log_row.id)
    db.commit()

    background_tasks.add_task(_dispatch_alert_logs, log_ids=log_ids, sender=sender)
    return SendAlertResponse(
        alert_type=payload.alert_type,
        message=payload.message,
        matched_recipients=len(targets),
        queued_logs=len(log_ids),
        status="queued",
    )
