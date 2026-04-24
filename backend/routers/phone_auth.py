"""Authenticated phone verification endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.middleware.rate_limit_middleware import extract_client_ip
from backend.models.phone_verification import PhoneVerificationChannel
from backend.models.user import User
from backend.schemas.phone_verification import (
    PhoneVerificationConfirmRequest,
    PhoneVerificationConfirmResponse,
    PhoneVerificationStartRequest,
    PhoneVerificationStartResponse,
)
from backend.security import get_current_user
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


router = APIRouter(tags=["Authentication"])


def get_otp_service() -> OTPService:
    return OTPService(sms_provider=build_sms_provider())


@router.post("/phone/start-verification", response_model=PhoneVerificationStartResponse)
def start_phone_verification(
    payload: PhoneVerificationStartRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    otp_service: OTPService = Depends(get_otp_service),
) -> PhoneVerificationStartResponse:
    try:
        result = otp_service.start_user_verification(
            db,
            user=current_user,
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


@router.post("/phone/confirm-verification", response_model=PhoneVerificationConfirmResponse)
def confirm_phone_verification(
    payload: PhoneVerificationConfirmRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    otp_service: OTPService = Depends(get_otp_service),
) -> PhoneVerificationConfirmResponse:
    try:
        result = otp_service.confirm_user_verification(
            db,
            user=current_user,
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
