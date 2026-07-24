"""Application configuration using Pydantic BaseSettings."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Literal

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _resolve_env_file() -> str:
    """Resolve the correct .env file by checking candidates on disk.

    Checks files by priority order using filesystem existence
    (not os.environ, which may not be populated at import time):
      1. .env (user's runtime config — copied from .env.local)
      2. .env.local (local dev overrides)
      3. .env.development (env-specific template)
      4. .env.production (env-specific template)

    Returns the first match, or ".env" as fallback for pydantic-settings.
    """
    script_dir = Path(__file__).resolve().parents[1]  # project root

    candidates = [
        ".env",            # 1. User's runtime config
        ".env.local",      # 2. Local dev overrides
        ".env.development",# 3. Dev template
        ".env.production", # 4. Production template
    ]
    for name in candidates:
        path = script_dir / name
        if path.exists():
            return str(path)

    return ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_resolve_env_file(),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # AI providers
    groq_api_key: str = ""
    anthropic_api_key: str = ""
    gemini_api_key: str = ""
    openai_api_key: str = ""
    ai_provider: Literal[
        "groq", "anthropic", "gemini", "claude", "google", "openai", "gpt"
    ] = "groq"

    # JWT
    jwt_secret_key: str = ""
    jwt_rsa_private_key: str = ""
    jwt_expire_hours: int = 8

    # App
    app_name: str = "DPR.ai"
    app_env: str = "development"
    debug: bool = False
    log_level: str = "INFO"
    log_format: str = "text"  # or json
    fastapi_port: int = 8765
    streamlit_port: int = 8502

    # Security / encryption
    data_encryption_key: str = ""

    # Database
    database_url: str = ""

    # Validators
    @field_validator("ai_provider")
    @classmethod
    def validate_ai_provider(cls, v: str) -> str:
        allowed = {
            "groq",
            "anthropic",
            "gemini",
            "claude",
            "google",
            "openai",
            "gpt",
        }
        if v.lower() not in allowed:
            raise ValueError(
                f"AI_PROVIDER must be one of: {', '.join(sorted(allowed))}"
            )
        return v.lower()

    @model_validator(mode="after")
    def check_at_least_one_ai_key(self) -> "Settings":
        if not any(
            [
                self.groq_api_key,
                self.anthropic_api_key,
                self.gemini_api_key,
                self.openai_api_key,
            ]
        ):
            raise ValueError(
                "At least one AI provider key is required: "
                "GROQ_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY."
            )
        # Validate encryption key length (Fernet requires 32 url-safe base64 bytes)
        try:
            from cryptography.fernet import Fernet

            Fernet(self.data_encryption_key.encode("utf-8"))
        except Exception as e:
            raise ValueError(
                "Invalid DATA_ENCRYPTION_KEY. Must be a valid Fernet key."
            ) from e
        return self

    @property
    def database_url_sync(self) -> str:
        """Return a SQLAlchemy‑compatible URL (sync)."""
        url = self.database_url
        if url.startswith("sqlite:///"):
            # Make path absolute relative to project root
            db_path = Path(url.replace("sqlite:///", ""))
            if not db_path.is_absolute():
                db_path = (Path(__file__).resolve().parents[1] / db_path).resolve()
                return f"sqlite:///{db_path}"
        return url


# Lazy, cached settings getter to preserve existing get_config() signature
from functools import lru_cache


@lru_cache
def get_settings() -> Settings:
    return Settings()


# For backward compatibility with existing code that expects AppConfig-like object
# we expose the same attribute names via a simple proxy.
class _SettingsProxy:
    def __getattr__(self, name):
        return getattr(get_settings(), name)


config = _SettingsProxy()