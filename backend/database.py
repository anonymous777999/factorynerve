"""Database engine, session management, and initialization."""

from __future__ import annotations

import base64
import hashlib
import logging
import os
from datetime import datetime, timezone
from typing import Any, Generator

from cryptography.fernet import Fernet
from sqlalchemy import MetaData, create_engine, event, inspect, text
from sqlalchemy.engine import Engine
from pathlib import Path

from sqlalchemy.orm import Session, declarative_base, sessionmaker
from sqlalchemy.types import TEXT, TypeDecorator

from backend.utils import get_config


logger = logging.getLogger(__name__)
config = get_config()
_IS_SQLITE = config.database_url.startswith("sqlite")
if config.app_env == "production" and _IS_SQLITE:
    raise RuntimeError("SQLite is not allowed in production. Set DATABASE_URL to PostgreSQL.")

NAMING_CONVENTION = {
    "ix": "ix_%(table_name)s_%(column_0_name)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}
metadata = MetaData(naming_convention=NAMING_CONVENTION)
Base = declarative_base(metadata=metadata)



pool_kwargs: dict[str, Any] = {}
if not _IS_SQLITE:
    pool_kwargs = {
        "pool_size": int(os.getenv("DB_POOL_SIZE", "10")),
        "max_overflow": int(os.getenv("DB_POOL_OVERFLOW", "10")),
        "pool_timeout": int(os.getenv("DB_POOL_TIMEOUT", "10")),
        "pool_recycle": int(os.getenv("DB_POOL_RECYCLE", "1800")),
    }

engine: Engine = create_engine(
    config.database_url,
    connect_args={"check_same_thread": False} if _IS_SQLITE else {},
    future=True,
    pool_pre_ping=True,
    **pool_kwargs,
)

if _IS_SQLITE:
    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, _connection_record) -> None:
        cursor = dbapi_connection.cursor()
        try:
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA synchronous=NORMAL")
            cursor.execute("PRAGMA busy_timeout=30000")
        finally:
            cursor.close()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)


class EncryptedString(TypeDecorator):
    """Encrypted text storage for sensitive data at rest."""

    impl = TEXT
    cache_ok = True

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self._fernet = Fernet(config.data_encryption_key.encode("utf-8"))

    def process_bind_param(self, value: Any, _dialect: Any) -> Any:
        if value is None:
            return None
        if not isinstance(value, str):
            raise ValueError("Encrypted fields must be strings.")
        return self._fernet.encrypt(value.encode("utf-8")).decode("utf-8")

    def process_result_value(self, value: Any, _dialect: Any) -> Any:
        if value is None:
            return None
        try:
            return self._fernet.decrypt(value.encode("utf-8")).decode("utf-8")
        except Exception as error:  # pylint: disable=broad-except
            logger.exception("Failed to decrypt database field (returning None).")
            # FIX (DB-01): Return None instead of raising ValueError — a single
            # corrupted encrypted field should not crash every request that reads it.
            return None


def hash_ip_address(ip_address: str | None) -> str | None:
    if not ip_address:
        return None
    return hashlib.sha256(ip_address.encode("utf-8")).hexdigest()


def hash_details(details: str | None) -> str | None:
    if not details:
        return None
    digest = hashlib.sha256(details.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest).decode("utf-8")


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _audit_log_user_id(obj: Any) -> int | None:
    user_id = getattr(obj, "user_id", None)
    if user_id is not None:
        return int(user_id)

    if obj.__class__.__name__ == "User":
        user_pk = getattr(obj, "id", None)
        if user_pk is not None:
            return int(user_pk)

    return None


@event.listens_for(Session, "before_flush")
def _audit_writes(session: Session, _flush_context: Any, _instances: Any) -> None:
    from backend.models.report import AuditLog
    from backend.models.feature_usage import FeatureUsage
    from backend.models.org_feature_usage import OrgFeatureUsage
    from backend.models.ocr_usage import OcrUsage
    from backend.models.org_ocr_usage import OrgOcrUsage
    from backend.models.org_whatsapp_usage import OrgWhatsAppUsage
    from backend.models.ops_alert_event import OpsAlertEvent
    from backend.models.refresh_token import RefreshToken

    excluded = (AuditLog, FeatureUsage, OrgFeatureUsage, OcrUsage, OrgOcrUsage, OrgWhatsAppUsage, OpsAlertEvent, RefreshToken)
    tracked_new = [obj for obj in session.new if not isinstance(obj, excluded)]
    tracked_dirty = [
        obj for obj in session.dirty if session.is_modified(obj) and not isinstance(obj, excluded)
    ]
    tracked_deleted = [obj for obj in session.deleted if not isinstance(obj, excluded)]

    for obj in tracked_new:
        org_id = getattr(obj, "org_id", None)
        factory_id = getattr(obj, "factory_id", None)
        session.add(
            AuditLog(
                user_id=_audit_log_user_id(obj),
                org_id=org_id,
                factory_id=factory_id,
                action=f"create_{obj.__class__.__name__.lower()}",
                details=f"Created {obj.__class__.__name__}",
                ip_address=None,
                timestamp=datetime.now(timezone.utc),
            )
        )
    for obj in tracked_dirty:
        org_id = getattr(obj, "org_id", None)
        factory_id = getattr(obj, "factory_id", None)
        session.add(
            AuditLog(
                user_id=_audit_log_user_id(obj),
                org_id=org_id,
                factory_id=factory_id,
                action=f"update_{obj.__class__.__name__.lower()}",
                details=f"Updated {obj.__class__.__name__}",
                ip_address=None,
                timestamp=datetime.now(timezone.utc),
            )
        )
    for obj in tracked_deleted:
        org_id = getattr(obj, "org_id", None)
        factory_id = getattr(obj, "factory_id", None)
        session.add(
            AuditLog(
                user_id=_audit_log_user_id(obj),
                org_id=org_id,
                factory_id=factory_id,
                action=f"delete_{obj.__class__.__name__.lower()}",
                details=f"Deleted {obj.__class__.__name__}",
                ip_address=None,
                timestamp=datetime.now(timezone.utc),
            )
        )


def init_db() -> None:
    """Initialize database tables via ``create_all`` then stamp Alembic head.

    Imports all model modules so ``Base.metadata`` is complete, then creates
    tables and indexes via ``Base.metadata.create_all``.  After creation,
    stamps the Alembic migration chain as current (``stamp head``) so future
    schema changes can be applied incrementally via ``alembic upgrade head``
    at deployment time.

    Safe to call multiple times.  On SQLite, ``create_all`` is wrapped in a
    try/except to handle a known SQLAlchemy ``checkfirst`` false-negative
    edge case where already-existing indexes are not detected.
    """
    try:
        import backend.models.alert  # noqa: F401
        import backend.models.entry  # noqa: F401
        import backend.models.attendance_record  # noqa: F401
        import backend.models.attendance_event  # noqa: F401
        import backend.models.attendance_regularization  # noqa: F401
        import backend.models.employee_profile  # noqa: F401
        import backend.models.organization  # noqa: F401
        import backend.models.factory  # noqa: F401
        import backend.models.user_factory_role  # noqa: F401
        import backend.models.factory_settings  # noqa: F401
        import backend.models.report  # noqa: F401
        import backend.models.user  # noqa: F401
        import backend.models.ocr_template  # noqa: F401
        import backend.models.ocr_verification  # noqa: F401
        import backend.models.ocr_usage  # noqa: F401
        import backend.models.user_plan  # noqa: F401
        import backend.models.feature_usage  # noqa: F401
        import backend.models.org_feature_usage  # noqa: F401
        import backend.models.email_queue  # noqa: F401
        import backend.models.subscription  # noqa: F401
        import backend.models.org_subscription_addon  # noqa: F401
        import backend.models.invoice  # noqa: F401
        import backend.models.webhook_event  # noqa: F401
        import backend.models.refresh_token  # noqa: F401
        import backend.models.org_ocr_usage  # noqa: F401
        import backend.models.org_whatsapp_usage  # noqa: F401
        import backend.models.payment_order  # noqa: F401
        import backend.models.intelligence_request  # noqa: F401
        import backend.models.intelligence_stage_usage  # noqa: F401
        import backend.models.ai_result_cache  # noqa: F401
        import backend.models.ai_usage_log  # noqa: F401
        import backend.models.steel_inventory_item  # noqa: F401
        import backend.models.steel_inventory_transaction  # noqa: F401
        import backend.models.steel_stock_reconciliation  # noqa: F401
        import backend.models.steel_machine_downtime_event  # noqa: F401
        import backend.models.steel_maintenance_task  # noqa: F401
        import backend.models.steel_vendor  # noqa: F401
        import backend.models.steel_vendor_bill  # noqa: F401
        import backend.models.steel_vendor_bill_line  # noqa: F401
        import backend.models.steel_vendor_payment  # noqa: F401
        import backend.models.steel_vendor_payment_allocation  # noqa: F401
        import backend.models.steel_expense  # noqa: F401
        import backend.models.steel_cash_account  # noqa: F401
        import backend.models.steel_cash_ledger_entry  # noqa: F401
        import backend.models.steel_production_batch  # noqa: F401
        import backend.models.steel_production_line  # noqa: F401
        import backend.models.steel_machine  # noqa: F401
        import backend.models.steel_sales_invoice  # noqa: F401
        import backend.models.steel_sales_invoice_line  # noqa: F401
        import backend.models.steel_customer  # noqa: F401
        import backend.models.steel_customer_follow_up_task  # noqa: F401
        import backend.models.steel_customer_payment  # noqa: F401
        import backend.models.steel_customer_payment_allocation  # noqa: F401
        import backend.models.steel_dispatch  # noqa: F401
        import backend.models.steel_dispatch_line  # noqa: F401
        import backend.models.password_reset_token  # noqa: F401
        import backend.models.auth_user  # noqa: F401
        import backend.models.auth_session  # noqa: F401
        import backend.models.auth_password_reset  # noqa: F401
        import backend.models.auth_audit_log  # noqa: F401
        import backend.models.shift_template  # noqa: F401
        import backend.models.email_verification_token  # noqa: F401
        import backend.models.ops_alert_event  # noqa: F401
        import backend.models.pending_registration  # noqa: F401
        import backend.models.admin_alert_recipient  # noqa: F401
        import backend.models.ops_alert_daily_summary  # noqa: F401
        import backend.models.phone_verification  # noqa: F401
        import backend.models.feedback  # noqa: F401
        import backend.models.approval_instance  # noqa: F401
        import backend.models.workforce_cost_rate  # noqa: F401
        import backend.models.defect_reason  # noqa: F401
        import backend.models.idempotency_key  # noqa: F401
        import backend.models.rate_limit  # noqa: F401

        # Create tables and indexes.  On SQLite, wrap in try/except for a known
        # SQLAlchemy ``checkfirst`` false-negative edge case where already-existing
        # indexes are not detected and ``create_all`` raises an OperationalError.
        try:
            Base.metadata.create_all(bind=engine)
        except Exception as create_error:  # pylint: disable=broad-except
            logger.warning(
                "Non-fatal schema creation error (likely existing index): %s",
                create_error,
            )

        # ── Apply pending Alembic migrations ────────────────────────────
        # Run alembic upgrade head to apply any pending migrations (e.g.
        # adding the user_id column to auth_password_resets). This ensures
        # the database schema stays in sync with the code without requiring
        # shell access to run alembic manually on the production server.
        try:
            from alembic.config import Config
            from alembic import command

            alembic_cfg = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))

            # Ensure alembic_version table exists before running upgrade.
            # SQLAlchemy's create_all above takes care of table creation,
            # but the version table may not exist if init_db is called on
            # a fresh database without Alembic history.
            with engine.begin() as conn:
                conn.execute(
                    text("CREATE TABLE IF NOT EXISTS alembic_version (version_num VARCHAR(32) NOT NULL PRIMARY KEY)")
                )

            # Run all pending migrations up to the current head.
            # ``alembic.command.upgrade`` is safe to call when already at
            # head — it's a no-op (no pending migrations to apply).
            command.upgrade(alembic_cfg, "head")
            logger.info("Alembic migrations applied up to head.")
        except Exception as migration_error:
            logger.warning(
                "Could not apply Alembic migrations (non-fatal): %s",
                migration_error,
            )

        logger.info("Database initialization complete.")
    except Exception as error:  # pylint: disable=broad-except
        logger.exception("Database initialization failed.")
        raise RuntimeError("Could not initialize database.") from error
