"""Request and response schemas for phone verification flows."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from backend.phone_utils import normalize_phone_e164


class PhoneVerificationStartRequest(BaseModel):
    phone: str = Field(min_length=7, max_length=32)

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value: str) -> str:
        return normalize_phone_e164(value)


class PhoneVerificationConfirmRequest(BaseModel):
    phone: str = Field(min_length=7, max_length=32)
    otp: str = Field(min_length=6, max_length=6)

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value: str) -> str:
        return normalize_phone_e164(value)

    @field_validator("otp")
    @classmethod
    def validate_otp(cls, value: str) -> str:
        otp = str(value or "").strip()
        if not otp.isdigit() or len(otp) != 6:
            raise ValueError("OTP must be a 6-digit code.")
        return otp


class PhoneVerificationStartResponse(BaseModel):
    masked_phone: str
    expires_in: int


class PhoneVerificationConfirmResponse(BaseModel):
    verified: bool
    phone_e164: str


class PhoneVerificationStatusResponse(BaseModel):
    phone_number: str | None = None
    phone_e164: str | None = None
    verification_status: str
    verified_at: datetime | None = None
