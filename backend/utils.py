"""Configuration and logging utilities for DPR.ai backend."""

from __future__ import annotations

import json
import logging
import os
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from functools import lru_cache
from contextvars import ContextVar
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Any
import secrets
import string

from cryptography.fernet import Fernet
from dotenv import load_dotenv


PROJECT_ROOT = Path(__file__).resolve().parents[1]
LOGS_DIR = PROJECT_ROOT / "logs"
ENV_PATH = PROJECT_ROOT / ".env"
FAILED_PAYLOAD_DIR = PROJECT_ROOT / "exports" / "failed_payloads"
_CONTROL_CHARS_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")
_PHONE_ALLOWED_RE = re.compile(r"^\+?[\d\s().-]+$")
_IDENTIFIER_ALLOWED_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9/_-]{0,31}$")
_REFERENCE_ALLOWED_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9 ./_-]*$")
request_id_var: ContextVar[str] = ContextVar("request_id", default="-")
_SENSITIVE_KEY_RE = re.compile(
    r"(api[_-]?key|secret|token|authorization|password|provider[_-]?key|bearer)",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class AppConfig:
    groq_api_key: str
    anthropic_api_key: str
    gemini_api_key: str
    ai_provider: str
    jwt_secret_key: str
    jwt_expire_hours: int
    app_name: str
    app_env: str
    debug: bool
    log_level: str
    log_format: str
    fastapi_port: int
    streamlit_port: int
    data_encryption_key: str
    database_url: str


def _to_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _to_int(value: str | None, default: int) -> int:
    if value is None:
        return default
    return int(value)


def _validate_required_values(raw_values: dict[str, str | None]) -> None:
    missing_keys: list[str] = []
    for key in (
        "AI_PROVIDER",
        "JWT_SECRET_KEY",
        "JWT_EXPIRE_HOURS",
        "APP_NAME",
        "LOG_LEVEL",
        "DATA_ENCRYPTION_KEY",
    ):
        value = raw_values.get(key)
        if value is None or (isinstance(value, str) and not value.strip()):
            missing_keys.append(key)
    if missing_keys:
        raise ValueError("Missing required environment variables: " + ", ".join(sorted(missing_keys)))

    provider = str(raw_values.get("AI_PROVIDER") or "").strip().lower()
    allowed_providers = {"groq", "anthropic", "gemini", "claude", "google"}
    if provider not in allowed_providers:
        raise ValueError("AI_PROVIDER must be one of: groq, anthropic, gemini.")

    provider_keys = {
        "groq": str(raw_values.get("GROQ_API_KEY") or "").strip(),
        "anthropic": str(raw_values.get("ANTHROPIC_API_KEY") or "").strip(),
        "gemini": str(raw_values.get("GEMINI_API_KEY") or "").strip(),
    }
    if not any(provider_keys.values()):
        raise ValueError(
            "At least one AI provider key is required: GROQ_API_KEY, ANTHROPIC_API_KEY, or GEMINI_API_KEY."
        )
    try:
        Fernet(str(raw_values.get("DATA_ENCRYPTION_KEY")).encode("utf-8"))
    except Exception as error:  # pylint: disable=broad-except
        raise ValueError("Invalid DATA_ENCRYPTION_KEY. Use a valid Fernet key.") from error


def _normalize_database_url(database_url: str) -> str:
    if database_url.startswith("sqlite:///"):
        path = database_url.replace("sqlite:///", "", 1)
        if not Path(path).is_absolute():
            resolved = (PROJECT_ROOT / path).resolve()
            return f"sqlite:///{resolved.as_posix()}"
    return database_url


@lru_cache(maxsize=1)
def get_config() -> AppConfig:
    load_dotenv(ENV_PATH)
    raw = {
        "GROQ_API_KEY": os.getenv("GROQ_API_KEY"),
        "ANTHROPIC_API_KEY": os.getenv("ANTHROPIC_API_KEY"),
        "GEMINI_API_KEY": os.getenv("GEMINI_API_KEY"),
        "AI_PROVIDER": os.getenv("AI_PROVIDER"),
        "JWT_SECRET_KEY": os.getenv("JWT_SECRET_KEY"),
        "JWT_EXPIRE_HOURS": os.getenv("JWT_EXPIRE_HOURS"),
        "APP_NAME": os.getenv("APP_NAME"),
        "APP_ENV": os.getenv("APP_ENV", "development"),
        "DEBUG": os.getenv("DEBUG"),
        "LOG_LEVEL": os.getenv("LOG_LEVEL"),
        "LOG_FORMAT": os.getenv("LOG_FORMAT", "text"),
        "FASTAPI_PORT": os.getenv("FASTAPI_PORT"),
        "STREAMLIT_PORT": os.getenv("STREAMLIT_PORT"),
        "DATA_ENCRYPTION_KEY": os.getenv("DATA_ENCRYPTION_KEY"),
        "DATABASE_URL": os.getenv(
            "DATABASE_URL", f"sqlite:///{(PROJECT_ROOT / 'dpr_ai.db').as_posix()}"
        ),
    }
    _validate_required_values(raw)
    return AppConfig(
        groq_api_key=str(raw.get("GROQ_API_KEY") or ""),
        anthropic_api_key=str(raw.get("ANTHROPIC_API_KEY") or ""),
        gemini_api_key=str(raw.get("GEMINI_API_KEY") or ""),
        ai_provider=str(raw["AI_PROVIDER"]),
        jwt_secret_key=str(raw["JWT_SECRET_KEY"]),
        jwt_expire_hours=_to_int(raw["JWT_EXPIRE_HOURS"], 24),
        app_name=str(raw["APP_NAME"]),
        app_env=str(raw.get("APP_ENV") or "development").strip().lower(),
        debug=_to_bool(raw["DEBUG"], False),
        log_level=str(raw.get("LOG_LEVEL") or "INFO").upper(),
        log_format=str(raw.get("LOG_FORMAT") or "text").strip().lower(),
        fastapi_port=_to_int(raw["FASTAPI_PORT"], 8765),
        streamlit_port=_to_int(raw["STREAMLIT_PORT"], 8502),
        data_encryption_key=str(raw["DATA_ENCRYPTION_KEY"]),
        database_url=_normalize_database_url(str(raw["DATABASE_URL"])),
    )


def setup_logging() -> None:
    config = get_config()
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    log_file = LOGS_DIR / "app.log"

    formatter = logging.Formatter(
        "%(asctime)s | %(levelname)s | %(name)s | %(request_id)s | %(message)s"
    )

    class JsonFormatter(logging.Formatter):
        def format(self, record: logging.LogRecord) -> str:
            payload: dict[str, Any] = {
                "timestamp": datetime.fromtimestamp(record.created, timezone.utc).isoformat(),
                "level": record.levelname,
                "logger": record.name,
                "request_id": getattr(record, "request_id", "-"),
                "message": record.getMessage(),
            }
            for key in (
                "event",
                "method",
                "path",
                "status",
                "duration_ms",
                "frontend_url",
                "release",
                "source",
            ):
                value = getattr(record, key, None)
                if value is not None:
                    payload[key] = value
            if record.exc_info:
                payload["exception"] = self.formatException(record.exc_info)
            return json.dumps(redact_secrets(payload), ensure_ascii=False)

    class RequestIdFilter(logging.Filter):
        def filter(self, record: logging.LogRecord) -> bool:
            record.request_id = request_id_var.get()
            return True

    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    root_logger.setLevel(getattr(logging, config.log_level, logging.INFO))

    console_handler = logging.StreamHandler()
    console_handler.setFormatter(JsonFormatter() if config.log_format == "json" else formatter)
    console_handler.addFilter(RequestIdFilter())

    file_handler = RotatingFileHandler(
        filename=log_file, maxBytes=5 * 1024 * 1024, backupCount=3, encoding="utf-8"
    )
    file_handler.setFormatter(JsonFormatter() if config.log_format == "json" else formatter)
    file_handler.addFilter(RequestIdFilter())

    root_logger.addHandler(console_handler)
    root_logger.addHandler(file_handler)


def parse_whatsapp_export(text: str) -> str:
    production_keywords = (
        "production",
        "target",
        "produced",
        "shift",
        "downtime",
        "manpower",
        "attendance",
        "quality",
        "material",
        "units",
        "machine",
        "output",
        "utpadan",
        "nirman",
        "upadan",
        "manpower",
    )
    system_patterns = (
        "joined using this group's invite link",
        "added",
        "removed",
        "changed the group",
        "deleted this message",
        "<media omitted>",
        "message was deleted",
    )
    cleaned_lines: list[str] = []
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        line = re.sub(r"^\d{1,2}/\d{1,2}/\d{2,4},\s*\d{1,2}:\d{2}\s*-\s*", "", line)
        if ":" in line:
            _, message = line.split(":", 1)
            line = message.strip()
        lower_line = line.lower()
        if any(pattern in lower_line for pattern in system_patterns):
            continue
        if any(keyword in lower_line for keyword in production_keywords):
            cleaned_lines.append(line)
    return "\n".join(cleaned_lines)


def sanitize_text(value: str | None, *, max_length: int | None = None, preserve_newlines: bool = True) -> str | None:
    if value is None:
        return None
    cleaned = value.replace("\r\n", "\n").replace("\r", "\n")
    cleaned = _CONTROL_CHARS_RE.sub("", cleaned).strip()
    if not preserve_newlines:
        cleaned = re.sub(r"\s+", " ", cleaned)
    if max_length is not None and len(cleaned) > max_length:
        cleaned = cleaned[:max_length]
    return cleaned


def normalize_phone_number(value: str | None, *, max_length: int = 32) -> str | None:
    cleaned = sanitize_text(value, max_length=max_length, preserve_newlines=False)
    if not cleaned:
        return None
    if "@" in cleaned:
        raise ValueError("Phone number cannot be an email address.")
    if cleaned.count("+") > 1 or ("+" in cleaned and not cleaned.startswith("+")):
        raise ValueError("Phone number can only use a leading + symbol.")
    if not _PHONE_ALLOWED_RE.fullmatch(cleaned):
        raise ValueError("Phone number can only contain digits, spaces, parentheses, periods, and hyphens.")
    digits = re.sub(r"\D", "", cleaned)
    if len(digits) < 10 or len(digits) > 15:
        raise ValueError("Phone number must contain 10 to 15 digits.")
    if len(set(digits)) == 1:
        raise ValueError("Phone number cannot use the same digit repeatedly.")
    if digits in {
        "0123456789",
        "1234567890",
        "0987654321",
        "9876543210",
    }:
        raise ValueError("Phone number looks invalid. Enter a real mobile number.")
    return cleaned


def normalize_identifier_code(
    value: str | None,
    *,
    field_name: str = "Code",
    max_length: int = 32,
) -> str | None:
    cleaned = sanitize_text(value, max_length=max_length, preserve_newlines=False)
    if not cleaned:
        return None
    if "@" in cleaned:
        raise ValueError(f"{field_name} cannot be an email address.")
    if len(cleaned) > max_length:
        raise ValueError(f"{field_name} must be {max_length} characters or fewer.")
    if not _IDENTIFIER_ALLOWED_RE.fullmatch(cleaned):
        raise ValueError(f"{field_name} can only use letters, numbers, hyphens, underscores, and slashes.")
    return cleaned


def normalize_reference_code(
    value: str | None,
    *,
    field_name: str = "Reference number",
    max_length: int = 80,
) -> str | None:
    cleaned = sanitize_text(value, max_length=max_length, preserve_newlines=False)
    if not cleaned:
        return None
    if "@" in cleaned:
        raise ValueError(f"{field_name} cannot be an email address.")
    if len(cleaned) > max_length:
        raise ValueError(f"{field_name} must be {max_length} characters or fewer.")
    if not _REFERENCE_ALLOWED_RE.fullmatch(cleaned):
        raise ValueError(f"{field_name} can only use letters, numbers, spaces, periods, hyphens, underscores, and slashes.")
    return cleaned


def redact_secrets(value: Any) -> Any:
    if isinstance(value, dict):
        redacted: dict[str, Any] = {}
        for key, item in value.items():
            key_str = str(key)
            if _SENSITIVE_KEY_RE.search(key_str):
                redacted[key_str] = "***redacted***"
            else:
                redacted[key_str] = redact_secrets(item)
        return redacted
    if isinstance(value, list):
        return [redact_secrets(item) for item in value]
    if isinstance(value, tuple):
        return tuple(redact_secrets(item) for item in value)
    return value


def generate_company_code(length: int = 8) -> str:
    """Generate a short, shareable company code (uppercase alphanumeric)."""
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def save_failed_payload(kind: str, payload: dict[str, Any], reason: str | None = None) -> str | None:
    try:
        FAILED_PAYLOAD_DIR.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S_%f")
        file_path = FAILED_PAYLOAD_DIR / f"{kind}_{timestamp}.json"
        safe_payload = redact_secrets(payload)
        data = {
            "kind": kind,
            "reason": reason,
            "saved_at": datetime.now(timezone.utc).isoformat(),
            "payload": safe_payload,
        }
        with file_path.open("w", encoding="utf-8") as handle:
            json.dump(data, handle, ensure_ascii=False, indent=2)
        return str(file_path)
    except Exception:  # pylint: disable=broad-except
        logging.getLogger(__name__).exception("Failed to save payload locally.")
        return None


def check_entry_alerts(entry: Any) -> list[dict[str, str]]:
    alerts: list[dict[str, str]] = []
    target = float(getattr(entry, "units_target", 0) or 0)
    produced = float(getattr(entry, "units_produced", 0) or 0)
    if target > 0 and produced < 0.8 * target:
        percent = round((produced / target) * 100, 2)
        alerts.append(
            {"type": "LOW_PRODUCTION", "message": f"Production at {percent}% of target (below 80%).", "severity": "high"}
        )
    downtime = int(getattr(entry, "downtime_minutes", 0) or 0)
    if downtime > 60:
        alerts.append(
            {"type": "HIGH_DOWNTIME", "message": f"Downtime is {downtime} minutes (above 60).", "severity": "medium"}
        )
    present = int(getattr(entry, "manpower_present", 0) or 0)
    absent = int(getattr(entry, "manpower_absent", 0) or 0)
    total = present + absent
    if total > 0 and (absent / total) > 0.2:
        percent_absent = round((absent / total) * 100, 2)
        alerts.append(
            {"type": "MANPOWER_SHORTAGE", "message": f"Absenteeism at {percent_absent}% (above 20%).", "severity": "high"}
        )
    return alerts
