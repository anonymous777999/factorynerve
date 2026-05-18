from __future__ import annotations

import os
from typing import Literal

from pydantic import BaseModel, Field, model_validator


class BaseSettings(BaseModel):
    @classmethod
    def from_env(cls) -> "BaseSettings":
        data: dict[str, object] = {}
        for field_name, field_info in cls.model_fields.items():
            env_value = os.getenv(field_name)
            if env_value is not None:
                data[field_name] = env_value
                continue
            if field_info.default is not None:
                data[field_name] = field_info.default
        return cls.model_validate(data)


class BillingSettings(BaseSettings):
    RAZORPAY_KEY_ID: str = Field(default="")
    RAZORPAY_KEY_SECRET: str = Field(default="")
    RAZORPAY_WEBHOOK_SECRET: str = Field(default="")
    PAYMENT_PROVIDER: Literal["razorpay"] = "razorpay"

    @model_validator(mode="after")
    def validate_billing_settings(self) -> "BillingSettings":
        env = str(os.getenv("ENV") or os.getenv("APP_ENV") or "development").strip().lower()
        if env == "production" and "test_" in self.RAZORPAY_KEY_SECRET:
            raise ValueError("RAZORPAY_KEY_SECRET cannot use a test key when ENV=production.")

        whatsapp_provider_mode = str(os.getenv("WHATSAPP_PROVIDER_MODE") or "").strip().lower()
        if whatsapp_provider_mode == "razorpay":
            missing = [
                key
                for key, value in (
                    ("RAZORPAY_KEY_ID", self.RAZORPAY_KEY_ID),
                    ("RAZORPAY_KEY_SECRET", self.RAZORPAY_KEY_SECRET),
                    ("RAZORPAY_WEBHOOK_SECRET", self.RAZORPAY_WEBHOOK_SECRET),
                )
                if not str(value or "").strip()
            ]
            if missing:
                raise ValueError(
                    "WHATSAPP_PROVIDER_MODE=razorpay requires credentials: " + ", ".join(missing)
                )
        return self


billing_settings = BillingSettings.from_env()
