"""Database engine, session management, and initialization."""

from __future__ import annotations

import base64
import hashlib
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Generator

from cryptography.fernet import Fernet
from sqlalchemy import MetaData, create_engine, event, inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker
from sqlalchemy.types import TEXT, TypeDecorator

from backend.factory_profiles import DEFAULT_FACTORY_PROFILE, infer_factory_profile
from backend.factory_templates import default_workflow_template_key
from backend.utils import generate_company_code, get_config


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

_CANONICAL_PHONE_VERIFICATION_CHANNELS = {"whatsapp", "email"}
_CANONICAL_PHONE_VERIFICATION_PURPOSES = {"user_verification", "alert_recipient"}
_REQUIRED_MESSAGING_COLUMNS: dict[str, set[str]] = {
    "phone_verifications": {
        "phone_e164",
        "otp_hash",
        "expires_at",
        "attempts",
        "used",
        "channel",
        "purpose",
        "user_id",
        "recipient_id",
        "created_at",
    },
    "ops_alert_events": {
        "ref_id",
        "org_id",
        "org_name",
        "status",
        "event_type",
        "severity",
        "summary",
        "recipient_phone",
        "provider",
        "delivery_status",
        "provider_message_id",
        "provider_status_at",
        "delivered_at",
        "read_at",
        "failed_at",
        "provider_error_code",
        "provider_error_title",
        "created_at",
        "dispatched_at",
    },
}

pool_kwargs: dict[str, Any] = {}
if not _IS_SQLITE:
    pool_kwargs = {
        "pool_size": int(os.getenv("DB_POOL_SIZE", "3")),
        "max_overflow": int(os.getenv("DB_POOL_OVERFLOW", "3")),
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
            logger.exception("Failed to decrypt database field.")
            raise ValueError("Could not decrypt stored value.") from error


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
    """Initialize database tables, indexes, and repair schema drift.

    Safe to call multiple times — uses ``checkfirst`` on ``create_all`` and
    idempotent ``_ensure_*`` helpers for columns and indexes.  On SQLite,
    ``Base.metadata.create_all`` with ``checkfirst=True`` can fail when
    trying to create indexes that already exist (a known SQLAlchemy/SQLite
    edge case), so we skip ``create_all`` entirely when tables already exist.
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

        # Create tables and indexes.  Skip ``create_all`` on second+
        # call to avoid SQLite index-already-exists errors (a known
        # SQLAlchemy/SQLite edge case where ``checkfirst=True`` fails
        # to detect existing indexes).  The ``_ensure_*`` helpers below
        # handle column/index drift idempotently.
        _need_create_all = True
        try:
            inspector = inspect(engine)
            if "users" in inspector.get_table_names():
                _need_create_all = False
        except Exception:
            pass

        if _need_create_all:
            Base.metadata.create_all(bind=engine)
        _ensure_factory_profile_columns()
        _ensure_factory_template_columns()
        _ensure_user_code_columns()
        _ensure_users_columns()
        _ensure_auth_email_columns()
        _ensure_entry_columns()
        _ensure_entry_performance_indexes()
        _ensure_subscription_addon_columns()
        _ensure_ocr_verification_columns()
        _ensure_steel_columns()
        _ensure_attendance_columns()
        _ensure_phone_and_alerting_columns()
        _ensure_feedback_columns()
        _ensure_workforce_tables()
        _ensure_billing_schema_columns()
        _verify_messaging_schema_or_raise()
        logger.info("Database initialization complete.")
    except Exception as error:  # pylint: disable=broad-except
        logger.exception("Database initialization failed.")
        raise RuntimeError("Could not initialize database.") from error


def _ensure_postgres_enum_value(conn: Any, *, enum_name: str, enum_value: str) -> bool:
    """Add a missing PostgreSQL enum label without recreating the enum."""
    if conn.dialect.name != "postgresql":
        return False

    labels = conn.execute(
        text(
            """
            SELECT e.enumlabel
            FROM pg_type t
            JOIN pg_enum e
              ON e.enumtypid = t.oid
            WHERE t.typname = :enum_name
            """
        ),
        {"enum_name": enum_name},
    ).scalars().all()
    if not labels or enum_value in labels:
        return False

    conn.exec_driver_sql(f"ALTER TYPE {enum_name} ADD VALUE IF NOT EXISTS '{enum_value}'")
    logger.warning("Added missing PostgreSQL enum value %s.%s during startup drift repair.", enum_name, enum_value)
    return True


def _ensure_billing_schema_columns() -> None:
    """Repair drifted billing tables so runtime SQL matches the live schema."""
    try:
        with engine.begin() as conn:
            dialect = conn.dialect.name
            if "org_ocr_usage" in inspect(conn).get_table_names():
                if dialect == "sqlite":
                    org_ocr_columns = {row[1] for row in conn.exec_driver_sql("PRAGMA table_info(org_ocr_usage)").fetchall()}
                    org_ocr_indexes = {
                        row[1] for row in conn.exec_driver_sql("PRAGMA index_list('org_ocr_usage')").fetchall()
                    }
                else:
                    org_ocr_columns = {
                        str(row[0])
                        for row in conn.execute(
                            text(
                                """
                                SELECT column_name
                                FROM information_schema.columns
                                WHERE table_name = 'org_ocr_usage'
                                """
                            )
                        ).fetchall()
                    }
                    org_ocr_indexes = {
                        str(row[0])
                        for row in conn.execute(
                            text(
                                """
                                SELECT indexname
                                FROM pg_indexes
                                WHERE tablename = 'org_ocr_usage'
                                """
                            )
                        ).fetchall()
                    }
                if "ocr_limit" not in org_ocr_columns:
                    conn.exec_driver_sql("ALTER TABLE org_ocr_usage ADD COLUMN ocr_limit INTEGER NOT NULL DEFAULT 0")
                if "period_start" not in org_ocr_columns:
                    conn.exec_driver_sql("ALTER TABLE org_ocr_usage ADD COLUMN period_start TIMESTAMP")
                if "period_end" not in org_ocr_columns:
                    conn.exec_driver_sql("ALTER TABLE org_ocr_usage ADD COLUMN period_end TIMESTAMP")
                if "ix_org_ocr_usage_org_id" not in org_ocr_indexes:
                    conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_org_ocr_usage_org_id ON org_ocr_usage (org_id)")

            if "org_whatsapp_usage" in inspect(conn).get_table_names():
                if dialect == "sqlite":
                    org_wa_columns = {row[1] for row in conn.exec_driver_sql("PRAGMA table_info(org_whatsapp_usage)").fetchall()}
                    org_wa_indexes = {
                        row[1] for row in conn.exec_driver_sql("PRAGMA index_list('org_whatsapp_usage')").fetchall()
                    }
                else:
                    org_wa_columns = {
                        str(row[0])
                        for row in conn.execute(
                            text(
                                """
                                SELECT column_name
                                FROM information_schema.columns
                                WHERE table_name = 'org_whatsapp_usage'
                                """
                            )
                        ).fetchall()
                    }
                    org_wa_indexes = {
                        str(row[0])
                        for row in conn.execute(
                            text(
                                """
                                SELECT indexname
                                FROM pg_indexes
                                WHERE tablename = 'org_whatsapp_usage'
                                """
                            )
                        ).fetchall()
                    }
                if "message_limit" not in org_wa_columns:
                    conn.exec_driver_sql("ALTER TABLE org_whatsapp_usage ADD COLUMN message_limit INTEGER NOT NULL DEFAULT 0")
                if "period_start" not in org_wa_columns:
                    conn.exec_driver_sql("ALTER TABLE org_whatsapp_usage ADD COLUMN period_start TIMESTAMP")
                if "period_end" not in org_wa_columns:
                    conn.exec_driver_sql("ALTER TABLE org_whatsapp_usage ADD COLUMN period_end TIMESTAMP")
                if "ix_org_whatsapp_usage_org_id" not in org_wa_indexes:
                    conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_org_whatsapp_usage_org_id ON org_whatsapp_usage (org_id)")

            if "payment_orders" in inspect(conn).get_table_names():
                if dialect == "sqlite":
                    payment_columns = {row[1] for row in conn.exec_driver_sql("PRAGMA table_info(payment_orders)").fetchall()}
                    payment_indexes = {
                        row[1] for row in conn.exec_driver_sql("PRAGMA index_list('payment_orders')").fetchall()
                    }
                else:
                    payment_columns = {
                        str(row[0])
                        for row in conn.execute(
                            text(
                                """
                                SELECT column_name
                                FROM information_schema.columns
                                WHERE table_name = 'payment_orders'
                                """
                            )
                        ).fetchall()
                    }
                    payment_indexes = {
                        str(row[0])
                        for row in conn.execute(
                            text(
                                """
                                SELECT indexname
                                FROM pg_indexes
                                WHERE tablename = 'payment_orders'
                                """
                            )
                        ).fetchall()
                    }
                if "org_id" not in payment_columns:
                    conn.exec_driver_sql("ALTER TABLE payment_orders ADD COLUMN org_id VARCHAR(36)")
                if "plan_id" not in payment_columns:
                    conn.exec_driver_sql("ALTER TABLE payment_orders ADD COLUMN plan_id VARCHAR(32)")
                if "amount_paise" not in payment_columns:
                    conn.exec_driver_sql("ALTER TABLE payment_orders ADD COLUMN amount_paise INTEGER")
                if "razorpay_order_id" not in payment_columns:
                    conn.exec_driver_sql("ALTER TABLE payment_orders ADD COLUMN razorpay_order_id VARCHAR(64)")
                if "receipt_id" not in payment_columns:
                    conn.exec_driver_sql("ALTER TABLE payment_orders ADD COLUMN receipt_id VARCHAR(120)")
                conn.exec_driver_sql(
                    """
                    UPDATE payment_orders
                    SET plan_id = COALESCE(plan_id, plan),
                        amount_paise = COALESCE(amount_paise, amount),
                        razorpay_order_id = COALESCE(razorpay_order_id, provider_order_id),
                        receipt_id = COALESCE(receipt_id, receipt),
                        org_id = COALESCE(
                            org_id,
                            (
                                SELECT users.org_id
                                FROM users
                                WHERE users.id = payment_orders.user_id
                            )
                        )
                    """
                )
                if "ix_payment_orders_org_id" not in payment_indexes:
                    conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_payment_orders_org_id ON payment_orders (org_id)")
                if "ix_payment_orders_razorpay_order_id" not in payment_indexes:
                    conn.exec_driver_sql(
                        "CREATE UNIQUE INDEX IF NOT EXISTS ix_payment_orders_razorpay_order_id ON payment_orders (razorpay_order_id)"
                    )
    except Exception:
        logger.exception("Failed to reconcile billing schema drift during startup.")


def _postgres_enum_labels(conn: Any, *, enum_name: str) -> set[str]:
    if conn.dialect.name != "postgresql":
        return set()
    return {
        str(label).strip()
        for label in conn.execute(
            text(
                """
                SELECT e.enumlabel
                FROM pg_type t
                JOIN pg_enum e
                  ON e.enumtypid = t.oid
                WHERE t.typname = :enum_name
                """
            ),
            {"enum_name": enum_name},
        ).scalars().all()
        if str(label).strip()
    }


def _verify_messaging_schema_or_raise() -> None:
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    missing_columns: list[str] = []

    for table_name, required_columns in _REQUIRED_MESSAGING_COLUMNS.items():
        if table_name not in table_names:
            missing_columns.append(f"{table_name} (missing table)")
            continue
        available_columns = {column["name"] for column in inspector.get_columns(table_name)}
        missing = sorted(required_columns - available_columns)
        missing_columns.extend(f"{table_name}.{column_name}" for column_name in missing)

    if missing_columns:
        raise RuntimeError(
            "Critical messaging schema drift detected. Missing messaging columns: " + ", ".join(missing_columns)
        )

    problems: list[str] = []
    with engine.connect() as conn:
        if conn.dialect.name == "postgresql":
            for enum_name, required_values in {
                "phone_verification_channel": _CANONICAL_PHONE_VERIFICATION_CHANNELS,
                "phone_verification_purpose": _CANONICAL_PHONE_VERIFICATION_PURPOSES,
            }.items():
                labels = _postgres_enum_labels(conn, enum_name=enum_name)
                if labels:
                    missing_values = sorted(required_values - labels)
                    if missing_values:
                        problems.append(f"{enum_name} missing values: {', '.join(missing_values)}")

        channels = {
            str(value).strip().lower()
            for value in conn.execute(
                text("SELECT DISTINCT channel FROM phone_verifications WHERE channel IS NOT NULL")
            ).scalars().all()
            if str(value).strip()
        }
        invalid_channels = sorted(channels - _CANONICAL_PHONE_VERIFICATION_CHANNELS)
        if invalid_channels:
            problems.append("phone_verifications.channel contains unsupported values: " + ", ".join(invalid_channels))

        purposes = {
            str(value).strip().lower()
            for value in conn.execute(
                text("SELECT DISTINCT purpose FROM phone_verifications WHERE purpose IS NOT NULL")
            ).scalars().all()
            if str(value).strip()
        }
        invalid_purposes = sorted(purposes - _CANONICAL_PHONE_VERIFICATION_PURPOSES)
        if invalid_purposes:
            problems.append("phone_verifications.purpose contains unsupported values: " + ", ".join(invalid_purposes))

    if problems:
        raise RuntimeError("Critical messaging schema drift detected. " + " | ".join(problems))


def _ensure_user_code_columns() -> None:
    """Ensure org-scoped 5+ digit user-facing IDs exist for every user."""
    try:
        inspector = inspect(engine)
        columns = {column["name"] for column in inspector.get_columns("users")}
        with engine.connect() as conn:
            if "user_code" not in columns:
                conn.exec_driver_sql("ALTER TABLE users ADD COLUMN user_code INTEGER")

            rows = conn.execute(
                text(
                    """
                    SELECT id, org_id, user_code
                    FROM users
                    ORDER BY org_id ASC, created_at ASC, id ASC
                    """
                )
            ).mappings().all()

            grouped: dict[str, list[dict[str, Any]]] = {}
            for row in rows:
                org_key = str(row["org_id"] or "__missing__")
                grouped.setdefault(org_key, []).append(dict(row))

            for items in grouped.values():
                used_codes: set[int] = set()
                highest_code = 9999

                for item in items:
                    raw_code = item.get("user_code")
                    code = int(raw_code) if raw_code is not None else None
                    if code is not None and code >= 10000 and code not in used_codes:
                        used_codes.add(code)
                        highest_code = max(highest_code, code)
                    else:
                        item["needs_backfill"] = True

                next_code = max(highest_code + 1, 10000)
                for item in items:
                    if not item.get("needs_backfill"):
                        continue
                    while next_code in used_codes:
                        next_code += 1
                    conn.execute(
                        text("UPDATE users SET user_code = :user_code WHERE id = :user_id"),
                        {"user_code": next_code, "user_id": item["id"]},
                    )
                    used_codes.add(next_code)
                    next_code += 1

            conn.exec_driver_sql(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_users_org_user_code ON users (org_id, user_code)"
            )
            conn.commit()
    except Exception:
        logger.exception("Failed to ensure users.user_code column.")


def _ensure_factory_profile_columns() -> None:
    """Ensure factories have a canonical industry profile column with safe defaults."""
    try:
        inspector = inspect(engine)
        factory_columns = {column["name"] for column in inspector.get_columns("factories")}
        settings_columns = {column["name"] for column in inspector.get_columns("factory_settings")}
        with engine.connect() as conn:
            if "industry_type" not in factory_columns:
                conn.exec_driver_sql(
                    f"ALTER TABLE factories ADD COLUMN industry_type VARCHAR(40) DEFAULT '{DEFAULT_FACTORY_PROFILE}'"
                )

            rows = conn.execute(
                text(
                    """
                    SELECT f.factory_id, f.industry_type, fs.factory_type
                    FROM factories f
                    LEFT JOIN factory_settings fs
                      ON fs.factory_name = f.name
                    ORDER BY f.created_at ASC, f.factory_id ASC
                    """
                )
            ).mappings().all()
            for row in rows:
                current = row.get("industry_type")
                if current and str(current).strip():
                    continue
                inferred = infer_factory_profile(
                    row.get("factory_type") if "factory_type" in settings_columns else None,
                    default=DEFAULT_FACTORY_PROFILE,
                )
                conn.execute(
                    text("UPDATE factories SET industry_type = :industry_type WHERE factory_id = :factory_id"),
                    {"industry_type": inferred, "factory_id": row["factory_id"]},
                )

            conn.exec_driver_sql(
                "CREATE INDEX IF NOT EXISTS ix_factories_industry_type ON factories (industry_type)"
            )
            conn.commit()
    except Exception:
        logger.exception("Failed to ensure factories.industry_type column.")


def _ensure_factory_template_columns() -> None:
    """Ensure factories have a canonical workflow template assignment."""
    try:
        inspector = inspect(engine)
        factory_columns = {column["name"] for column in inspector.get_columns("factories")}
        with engine.connect() as conn:
            if "workflow_template_key" not in factory_columns:
                conn.exec_driver_sql(
                    "ALTER TABLE factories ADD COLUMN workflow_template_key VARCHAR(64) DEFAULT 'general-ops-pack'"
                )

            rows = conn.execute(
                text(
                    """
                    SELECT factory_id, industry_type, workflow_template_key
                    FROM factories
                    ORDER BY created_at ASC, factory_id ASC
                    """
                )
            ).mappings().all()
            for row in rows:
                current = row.get("workflow_template_key")
                if current and str(current).strip():
                    continue
                template_key = default_workflow_template_key(row.get("industry_type"))
                conn.execute(
                    text(
                        "UPDATE factories SET workflow_template_key = :workflow_template_key WHERE factory_id = :factory_id"
                    ),
                    {"workflow_template_key": template_key, "factory_id": row["factory_id"]},
                )
            conn.commit()
    except Exception:
        logger.exception("Failed to ensure factories.workflow_template_key column.")


def _ensure_entry_columns() -> None:
    """Ensure entry idempotency metadata and quality intelligence columns."""
    try:
        inspector = inspect(engine)
        columns = {column["name"] for column in inspector.get_columns("entries")}
        with engine.connect() as conn:
            if "client_request_id" not in columns:
                conn.exec_driver_sql("ALTER TABLE entries ADD COLUMN client_request_id VARCHAR(64)")
            conn.exec_driver_sql(
                "CREATE INDEX IF NOT EXISTS ix_entries_client_request_id ON entries (client_request_id)"
            )
            # Quality intelligence columns (Phase 1+2)
            if "rejection_qty" not in columns:
                conn.exec_driver_sql("ALTER TABLE entries ADD COLUMN rejection_qty INTEGER")
            if "defect_reason_id" not in columns:
                conn.exec_driver_sql("ALTER TABLE entries ADD COLUMN defect_reason_id INTEGER")
            if "defect_reason_details" not in columns:
                conn.exec_driver_sql("ALTER TABLE entries ADD COLUMN defect_reason_details VARCHAR(300)")
            if "rework_required" not in columns:
                dialect = conn.dialect.name
                if dialect == "postgresql":
                    conn.exec_driver_sql("ALTER TABLE entries ADD COLUMN rework_required BOOLEAN NOT NULL DEFAULT FALSE")
                else:
                    conn.exec_driver_sql("ALTER TABLE entries ADD COLUMN rework_required BOOLEAN NOT NULL DEFAULT 0")
            if "scrap_qty_entry" not in columns:
                conn.exec_driver_sql("ALTER TABLE entries ADD COLUMN scrap_qty_entry INTEGER")
            try:
                conn.exec_driver_sql(
                    "CREATE INDEX IF NOT EXISTS ix_entries_defect_reason_id ON entries (defect_reason_id)"
                )
            except Exception:
                pass
            conn.commit()
    except Exception:
        logger.exception("Failed to ensure entries idempotency and quality columns.")


def _ensure_entry_performance_indexes() -> None:
    """Create composite indexes used by dashboard, analytics, and report queries."""
    try:
        with engine.connect() as conn:
            conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_entries_org_date ON entries (org_id, date)")
            conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_entries_factory_date ON entries (factory_id, date)")
            conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_entries_org_created_at ON entries (org_id, created_at)")
            conn.exec_driver_sql(
                "CREATE INDEX IF NOT EXISTS ix_entries_factory_shift_date ON entries (factory_id, shift, date)"
            )
            conn.exec_driver_sql(
                "CREATE INDEX IF NOT EXISTS ix_entries_org_shift_date ON entries (org_id, shift, date)"
            )
            conn.exec_driver_sql(
                "CREATE INDEX IF NOT EXISTS ix_entries_org_date_shift ON entries (org_id, date, shift)"
            )
            conn.commit()
    except Exception:
        logger.exception("Failed to ensure entry performance indexes.")


def _ensure_subscription_addon_columns() -> None:
    """Ensure recurring subscription add-ons can persist quantities."""
    try:
        inspector = inspect(engine)
        columns = {column["name"] for column in inspector.get_columns("org_subscription_addons")}
        with engine.connect() as conn:
            if "quantity" not in columns:
                conn.exec_driver_sql("ALTER TABLE org_subscription_addons ADD COLUMN quantity INTEGER DEFAULT 1")
            conn.exec_driver_sql("UPDATE org_subscription_addons SET quantity = 1 WHERE quantity IS NULL OR quantity < 1")
            conn.commit()
    except Exception:
        logger.exception("Failed to ensure org_subscription_addons.quantity column.")


def _ensure_ocr_verification_columns() -> None:
    """Ensure OCR verification records can store structured OCR metadata."""
    try:
        inspector = inspect(engine)
        table_names = set(inspector.get_table_names())
        if "ocr_verifications" not in table_names:
            return
        columns = {column["name"] for column in inspector.get_columns("ocr_verifications")}
        with engine.connect() as conn:
            if "scan_quality" not in columns:
                conn.exec_driver_sql("ALTER TABLE ocr_verifications ADD COLUMN scan_quality JSON")
            if "document_hash" not in columns:
                conn.exec_driver_sql("ALTER TABLE ocr_verifications ADD COLUMN document_hash VARCHAR(128)")
            if "doc_type_hint" not in columns:
                conn.exec_driver_sql("ALTER TABLE ocr_verifications ADD COLUMN doc_type_hint VARCHAR(80)")
            if "routing_meta" not in columns:
                conn.exec_driver_sql("ALTER TABLE ocr_verifications ADD COLUMN routing_meta JSON")
            if "raw_text" not in columns:
                conn.exec_driver_sql("ALTER TABLE ocr_verifications ADD COLUMN raw_text TEXT")
            conn.exec_driver_sql(
                "CREATE INDEX IF NOT EXISTS ix_ocr_verifications_document_hash ON ocr_verifications (document_hash)"
            )
            conn.commit()
    except Exception:
        logger.exception("Failed to ensure structured OCR verification columns.")


def _ensure_steel_columns() -> None:
    """Ensure steel extension columns exist on previously-created tables."""
    try:
        inspector = inspect(engine)
        with engine.connect() as conn:
            customer_columns = {column["name"] for column in inspector.get_columns("steel_customers")}
            if "customer_code" not in customer_columns:
                conn.exec_driver_sql("ALTER TABLE steel_customers ADD COLUMN customer_code VARCHAR(24)")
            if "city" not in customer_columns:
                conn.exec_driver_sql("ALTER TABLE steel_customers ADD COLUMN city VARCHAR(120)")
            if "state" not in customer_columns:
                conn.exec_driver_sql("ALTER TABLE steel_customers ADD COLUMN state VARCHAR(120)")
            if "gst_number" not in customer_columns:
                conn.exec_driver_sql("ALTER TABLE steel_customers ADD COLUMN gst_number VARCHAR(32)")
            if "pan_number" not in customer_columns:
                conn.exec_driver_sql("ALTER TABLE steel_customers ADD COLUMN pan_number VARCHAR(16)")
            if "company_type" not in customer_columns:
                conn.exec_driver_sql("ALTER TABLE steel_customers ADD COLUMN company_type VARCHAR(40)")
            if "contact_person" not in customer_columns:
                conn.exec_driver_sql("ALTER TABLE steel_customers ADD COLUMN contact_person VARCHAR(160)")
            if "designation" not in customer_columns:
                conn.exec_driver_sql("ALTER TABLE steel_customers ADD COLUMN designation VARCHAR(120)")
            if "credit_limit" not in customer_columns:
                conn.exec_driver_sql("ALTER TABLE steel_customers ADD COLUMN credit_limit NUMERIC(14, 2) DEFAULT 0")
            if "payment_terms_days" not in customer_columns:
                conn.exec_driver_sql("ALTER TABLE steel_customers ADD COLUMN payment_terms_days INTEGER DEFAULT 0")
            if "status" not in customer_columns:
                conn.exec_driver_sql("ALTER TABLE steel_customers ADD COLUMN status VARCHAR(24) DEFAULT 'active'")
            if "notes" not in customer_columns:
                conn.exec_driver_sql("ALTER TABLE steel_customers ADD COLUMN notes VARCHAR(500)")
            if "verification_status" not in customer_columns:
                conn.exec_driver_sql("ALTER TABLE steel_customers ADD COLUMN verification_status VARCHAR(24) DEFAULT 'draft'")
            if "pan_status" not in customer_columns:
                conn.exec_driver_sql("ALTER TABLE steel_customers ADD COLUMN pan_status VARCHAR(24) DEFAULT 'not_checked'")
            if "gst_status" not in customer_columns:
                conn.exec_driver_sql("ALTER TABLE steel_customers ADD COLUMN gst_status VARCHAR(24) DEFAULT 'not_checked'")
            if "verification_source" not in customer_columns:
                conn.exec_driver_sql("ALTER TABLE steel_customers ADD COLUMN verification_source VARCHAR(80)")
            if "official_legal_name" not in customer_columns:
                conn.exec_driver_sql("ALTER TABLE steel_customers ADD COLUMN official_legal_name VARCHAR(200)")
            if "official_trade_name" not in customer_columns:
                conn.exec_driver_sql("ALTER TABLE steel_customers ADD COLUMN official_trade_name VARCHAR(200)")
            if "official_state" not in customer_columns:
                conn.exec_driver_sql("ALTER TABLE steel_customers ADD COLUMN official_state VARCHAR(120)")
            if "name_match_status" not in customer_columns:
                conn.exec_driver_sql("ALTER TABLE steel_customers ADD COLUMN name_match_status VARCHAR(24) DEFAULT 'not_available'")
            if "state_match_status" not in customer_columns:
                conn.exec_driver_sql("ALTER TABLE steel_customers ADD COLUMN state_match_status VARCHAR(24) DEFAULT 'not_available'")
            if "match_score" not in customer_columns:
                conn.exec_driver_sql("ALTER TABLE steel_customers ADD COLUMN match_score NUMERIC(5, 2) DEFAULT 0")
            if "mismatch_reason" not in customer_columns:
                conn.exec_driver_sql("ALTER TABLE steel_customers ADD COLUMN mismatch_reason VARCHAR(500)")
            if "pan_document_path" not in customer_columns:
                conn.exec_driver_sql("ALTER TABLE steel_customers ADD COLUMN pan_document_path VARCHAR(255)")
            if "gst_document_path" not in customer_columns:
                conn.exec_driver_sql("ALTER TABLE steel_customers ADD COLUMN gst_document_path VARCHAR(255)")
            if "verified_at" not in customer_columns:
                conn.exec_driver_sql("ALTER TABLE steel_customers ADD COLUMN verified_at DATETIME")
            if "verified_by_user_id" not in customer_columns:
                conn.exec_driver_sql("ALTER TABLE steel_customers ADD COLUMN verified_by_user_id INTEGER")
            conn.exec_driver_sql(
                "UPDATE steel_customers SET credit_limit = 0 WHERE credit_limit IS NULL"
            )
            conn.exec_driver_sql(
                "UPDATE steel_customers SET payment_terms_days = 0 WHERE payment_terms_days IS NULL"
            )
            conn.exec_driver_sql(
                "UPDATE steel_customers SET status = 'active' WHERE status IS NULL OR TRIM(status) = ''"
            )
            conn.exec_driver_sql(
                "UPDATE steel_customers SET verification_status = 'draft' WHERE verification_status IS NULL OR TRIM(verification_status) = ''"
            )
            conn.exec_driver_sql(
                "UPDATE steel_customers SET pan_status = 'not_checked' WHERE pan_status IS NULL OR TRIM(pan_status) = ''"
            )
            conn.exec_driver_sql(
                "UPDATE steel_customers SET gst_status = 'not_checked' WHERE gst_status IS NULL OR TRIM(gst_status) = ''"
            )
            conn.exec_driver_sql(
                "UPDATE steel_customers SET name_match_status = 'not_available' WHERE name_match_status IS NULL OR TRIM(name_match_status) = ''"
            )
            conn.exec_driver_sql(
                "UPDATE steel_customers SET state_match_status = 'not_available' WHERE state_match_status IS NULL OR TRIM(state_match_status) = ''"
            )
            conn.exec_driver_sql(
                "UPDATE steel_customers SET match_score = 0 WHERE match_score IS NULL"
            )
            customer_rows = conn.execute(
                text(
                    """
                    SELECT id, customer_code
                    FROM steel_customers
                    ORDER BY id ASC
                    """
                )
            ).mappings().all()
            for row in customer_rows:
                if row["customer_code"]:
                    continue
                conn.execute(
                    text("UPDATE steel_customers SET customer_code = :customer_code WHERE id = :customer_id"),
                    {"customer_code": f"CUST-{int(row['id']):05d}", "customer_id": int(row["id"])},
                )
            conn.exec_driver_sql(
                "CREATE INDEX IF NOT EXISTS ix_steel_customers_status ON steel_customers (status)"
            )
            conn.exec_driver_sql(
                "CREATE INDEX IF NOT EXISTS ix_steel_customers_verification_status ON steel_customers (verification_status)"
            )
            conn.exec_driver_sql(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_steel_customers_factory_customer_code ON steel_customers (factory_id, customer_code)"
            )

            invoice_columns = {column["name"] for column in inspector.get_columns("steel_sales_invoices")}
            if "customer_id" not in invoice_columns:
                conn.exec_driver_sql("ALTER TABLE steel_sales_invoices ADD COLUMN customer_id INTEGER")
            if "due_date" not in invoice_columns:
                conn.exec_driver_sql("ALTER TABLE steel_sales_invoices ADD COLUMN due_date DATE")
            if "payment_terms_days" not in invoice_columns:
                conn.exec_driver_sql("ALTER TABLE steel_sales_invoices ADD COLUMN payment_terms_days INTEGER DEFAULT 0")
            conn.exec_driver_sql(
                "CREATE INDEX IF NOT EXISTS ix_steel_sales_invoices_customer_id ON steel_sales_invoices (customer_id)"
            )
            conn.exec_driver_sql(
                "UPDATE steel_sales_invoices SET payment_terms_days = 0 WHERE payment_terms_days IS NULL"
            )
            conn.exec_driver_sql(
                "UPDATE steel_sales_invoices SET due_date = invoice_date WHERE due_date IS NULL"
            )
            conn.exec_driver_sql(
                "UPDATE steel_sales_invoices SET status = 'unpaid' WHERE status IS NULL OR TRIM(status) = '' OR status = 'issued'"
            )
            conn.exec_driver_sql(
                "CREATE INDEX IF NOT EXISTS ix_steel_sales_invoices_due_date ON steel_sales_invoices (due_date)"
            )

            dispatch_columns = {column["name"] for column in inspector.get_columns("steel_dispatches")}
            if "transporter_name" not in dispatch_columns:
                conn.exec_driver_sql("ALTER TABLE steel_dispatches ADD COLUMN transporter_name VARCHAR(160)")
            if "vehicle_type" not in dispatch_columns:
                conn.exec_driver_sql("ALTER TABLE steel_dispatches ADD COLUMN vehicle_type VARCHAR(40)")
            if "truck_capacity_kg" not in dispatch_columns:
                conn.exec_driver_sql("ALTER TABLE steel_dispatches ADD COLUMN truck_capacity_kg NUMERIC(14, 3)")
            if "driver_license_number" not in dispatch_columns:
                conn.exec_driver_sql("ALTER TABLE steel_dispatches ADD COLUMN driver_license_number VARCHAR(80)")
            if "entry_time" not in dispatch_columns:
                conn.exec_driver_sql("ALTER TABLE steel_dispatches ADD COLUMN entry_time DATETIME")
            if "exit_time" not in dispatch_columns:
                conn.exec_driver_sql("ALTER TABLE steel_dispatches ADD COLUMN exit_time DATETIME")
            if "receiver_name" not in dispatch_columns:
                conn.exec_driver_sql("ALTER TABLE steel_dispatches ADD COLUMN receiver_name VARCHAR(160)")
            if "pod_notes" not in dispatch_columns:
                conn.exec_driver_sql("ALTER TABLE steel_dispatches ADD COLUMN pod_notes VARCHAR(500)")
            if "inventory_posted_at" not in dispatch_columns:
                conn.exec_driver_sql("ALTER TABLE steel_dispatches ADD COLUMN inventory_posted_at DATETIME")
            if "delivered_at" not in dispatch_columns:
                conn.exec_driver_sql("ALTER TABLE steel_dispatches ADD COLUMN delivered_at DATETIME")
            if "delivered_by_user_id" not in dispatch_columns:
                conn.exec_driver_sql("ALTER TABLE steel_dispatches ADD COLUMN delivered_by_user_id INTEGER")
            conn.exec_driver_sql(
                "UPDATE steel_dispatches SET inventory_posted_at = created_at WHERE inventory_posted_at IS NULL AND status IN ('dispatched', 'delivered')"
            )
            conn.exec_driver_sql(
                "CREATE INDEX IF NOT EXISTS ix_steel_dispatches_status ON steel_dispatches (status)"
            )

            # Inventory item columns (Phase 2: reorder, safety stock, coil weight, lead time)
            inv_columns = {column["name"] for column in inspector.get_columns("steel_inventory_items")}
            if "reorder_point_kg" not in inv_columns:
                conn.exec_driver_sql("ALTER TABLE steel_inventory_items ADD COLUMN reorder_point_kg FLOAT")
            if "safety_stock_kg" not in inv_columns:
                conn.exec_driver_sql("ALTER TABLE steel_inventory_items ADD COLUMN safety_stock_kg FLOAT")
            if "coil_weight_kg" not in inv_columns:
                conn.exec_driver_sql("ALTER TABLE steel_inventory_items ADD COLUMN coil_weight_kg FLOAT DEFAULT 0.0")
            if "lead_time_days" not in inv_columns:
                conn.exec_driver_sql("ALTER TABLE steel_inventory_items ADD COLUMN lead_time_days INTEGER")
            conn.exec_driver_sql(
                "UPDATE steel_inventory_items SET coil_weight_kg = 0.0 WHERE coil_weight_kg IS NULL"
            )

            reconciliation_columns = {
                column["name"] for column in inspector.get_columns("steel_stock_reconciliations")
            }
            if "status" not in reconciliation_columns:
                conn.exec_driver_sql(
                    "ALTER TABLE steel_stock_reconciliations ADD COLUMN status VARCHAR(16) DEFAULT 'pending'"
                )
            if "submitted_by_user_id" not in reconciliation_columns:
                conn.exec_driver_sql("ALTER TABLE steel_stock_reconciliations ADD COLUMN submitted_by_user_id INTEGER")
            if "approved_by_user_id" not in reconciliation_columns:
                conn.exec_driver_sql("ALTER TABLE steel_stock_reconciliations ADD COLUMN approved_by_user_id INTEGER")
            if "rejected_by_user_id" not in reconciliation_columns:
                conn.exec_driver_sql("ALTER TABLE steel_stock_reconciliations ADD COLUMN rejected_by_user_id INTEGER")
            if "approver_notes" not in reconciliation_columns:
                conn.exec_driver_sql("ALTER TABLE steel_stock_reconciliations ADD COLUMN approver_notes VARCHAR(500)")
            if "rejection_reason" not in reconciliation_columns:
                conn.exec_driver_sql("ALTER TABLE steel_stock_reconciliations ADD COLUMN rejection_reason VARCHAR(500)")
            if "mismatch_cause" not in reconciliation_columns:
                conn.exec_driver_sql("ALTER TABLE steel_stock_reconciliations ADD COLUMN mismatch_cause VARCHAR(40)")
            if "approved_at" not in reconciliation_columns:
                conn.exec_driver_sql("ALTER TABLE steel_stock_reconciliations ADD COLUMN approved_at DATETIME")
            if "rejected_at" not in reconciliation_columns:
                conn.exec_driver_sql("ALTER TABLE steel_stock_reconciliations ADD COLUMN rejected_at DATETIME")
            conn.exec_driver_sql(
                "UPDATE steel_stock_reconciliations SET status = 'approved' WHERE status IS NULL OR TRIM(status) = ''"
            )
            conn.exec_driver_sql(
                "CREATE INDEX IF NOT EXISTS ix_steel_stock_reconciliations_status ON steel_stock_reconciliations (status)"
            )

            # Production batch columns (coil theft detection + Phase 2)
            batch_columns = {column["name"] for column in inspector.get_columns("steel_production_batches")}
            if "coil_expected_weight_kg" not in batch_columns:
                conn.exec_driver_sql("ALTER TABLE steel_production_batches ADD COLUMN coil_expected_weight_kg FLOAT")
            if "coil_weight_variance_kg" not in batch_columns:
                conn.exec_driver_sql("ALTER TABLE steel_production_batches ADD COLUMN coil_weight_variance_kg FLOAT")
            if "coil_weight_variance_percent" not in batch_columns:
                conn.exec_driver_sql("ALTER TABLE steel_production_batches ADD COLUMN coil_weight_variance_percent FLOAT")
            if "is_coil_theft_suspected" not in batch_columns:
                dialect = conn.dialect.name
                if dialect == "postgresql":
                    conn.exec_driver_sql("ALTER TABLE steel_production_batches ADD COLUMN is_coil_theft_suspected BOOLEAN NOT NULL DEFAULT FALSE")
                else:
                    conn.exec_driver_sql("ALTER TABLE steel_production_batches ADD COLUMN is_coil_theft_suspected BOOLEAN NOT NULL DEFAULT 0")
            if "rejection_qty_kg" not in batch_columns:
                conn.exec_driver_sql("ALTER TABLE steel_production_batches ADD COLUMN rejection_qty_kg FLOAT")
            if "scrap_qty_kg" not in batch_columns:
                conn.exec_driver_sql("ALTER TABLE steel_production_batches ADD COLUMN scrap_qty_kg FLOAT")
            if "line_id" not in batch_columns:
                conn.exec_driver_sql("ALTER TABLE steel_production_batches ADD COLUMN line_id INTEGER")
            if "machine_id" not in batch_columns:
                conn.exec_driver_sql("ALTER TABLE steel_production_batches ADD COLUMN machine_id INTEGER")
            conn.exec_driver_sql(
                "UPDATE steel_production_batches SET is_coil_theft_suspected = FALSE WHERE is_coil_theft_suspected IS NULL"
            )
            conn.commit()
    except Exception:
        logger.exception("Failed to ensure steel extension columns.")


def _ensure_attendance_columns() -> None:
    """Ensure attendance tables have the extra review metadata expected by newer flows."""
    try:
        inspector = inspect(engine)
        table_names = set(inspector.get_table_names())
        if "attendance_records" not in table_names:
            return
        columns = {column["name"] for column in inspector.get_columns("attendance_records")}
        with engine.connect() as conn:
            if "shift_template_id" not in columns:
                conn.exec_driver_sql("ALTER TABLE attendance_records ADD COLUMN shift_template_id INTEGER")
            if "review_status" not in columns:
                conn.exec_driver_sql(
                    "ALTER TABLE attendance_records ADD COLUMN review_status VARCHAR(24) DEFAULT 'auto'"
                )
            if "approved_by_user_id" not in columns:
                conn.exec_driver_sql("ALTER TABLE attendance_records ADD COLUMN approved_by_user_id INTEGER")
            if "approved_at" not in columns:
                conn.exec_driver_sql("ALTER TABLE attendance_records ADD COLUMN approved_at DATETIME")
            conn.exec_driver_sql(
                "UPDATE attendance_records SET review_status = 'auto' WHERE review_status IS NULL OR TRIM(review_status) = ''"
            )
            conn.exec_driver_sql(
                "CREATE INDEX IF NOT EXISTS ix_attendance_records_review_status ON attendance_records (review_status)"
            )
            conn.commit()
    except Exception:
        logger.exception("Failed to ensure attendance extension columns.")


def _ensure_entries_columns() -> None:
    """Lightweight schema patching for new Entry columns (sqlite-friendly)."""
    try:
        with engine.connect() as conn:
            dialect = engine.dialect.name
            if dialect == "sqlite":
                cols = {row[1] for row in conn.exec_driver_sql("PRAGMA table_info(entries)").fetchall()}
                if "org_id" not in cols:
                    conn.exec_driver_sql("ALTER TABLE entries ADD COLUMN org_id VARCHAR(36)")
                if "factory_id" not in cols:
                    conn.exec_driver_sql("ALTER TABLE entries ADD COLUMN factory_id VARCHAR(36)")
                if "status" not in cols:
                    conn.exec_driver_sql("ALTER TABLE entries ADD COLUMN status VARCHAR(20) DEFAULT 'submitted'")
                if "department" not in cols:
                    conn.exec_driver_sql("ALTER TABLE entries ADD COLUMN department VARCHAR(120)")
                conn.exec_driver_sql("UPDATE entries SET status='submitted' WHERE status IS NULL")
                conn.exec_driver_sql(
                    """
                    UPDATE entries
                    SET department = (
                        SELECT CASE LOWER(COALESCE(role, ''))
                            WHEN 'admin' THEN 'Admin'
                            WHEN 'owner' THEN 'Owner'
                            WHEN 'manager' THEN 'Manager'
                            WHEN 'supervisor' THEN 'Supervisor'
                            WHEN 'operator' THEN 'Operator'
                            WHEN 'attendance' THEN 'Attendance'
                            WHEN 'accountant' THEN 'Accountant'
                            ELSE COALESCE(role, 'Operator')
                        END
                        FROM users
                        WHERE users.id = entries.user_id
                    )
                    WHERE department IS NULL OR TRIM(department) = ''
                    """
                )
                conn.exec_driver_sql(
                    """
                    UPDATE entries
                    SET org_id = (
                        SELECT org_id FROM users WHERE users.id = entries.user_id
                    )
                    WHERE org_id IS NULL
                    """
                )
                conn.exec_driver_sql(
                    """
                    UPDATE entries
                    SET factory_id = (
                        SELECT factory_id FROM factories
                        WHERE factories.name = (
                            SELECT factory_name FROM users WHERE users.id = entries.user_id
                        )
                        LIMIT 1
                    )
                    WHERE factory_id IS NULL
                    """
                )
            else:
                try:
                    conn.exec_driver_sql("ALTER TABLE entries ADD COLUMN org_id VARCHAR(36)")
                except Exception:
                    pass
                try:
                    conn.exec_driver_sql("ALTER TABLE entries ADD COLUMN factory_id VARCHAR(36)")
                except Exception:
                    pass
                try:
                    conn.exec_driver_sql("ALTER TABLE entries ADD COLUMN status VARCHAR(20) DEFAULT 'submitted'")
                except Exception:
                    pass
                try:
                    conn.exec_driver_sql("ALTER TABLE entries ADD COLUMN department VARCHAR(120)")
                except Exception:
                    pass
                try:
                    conn.exec_driver_sql("UPDATE entries SET status='submitted' WHERE status IS NULL")
                except Exception:
                    pass
                try:
                    conn.exec_driver_sql(
                        """
                        UPDATE entries
                        SET department = (
                            SELECT CASE LOWER(COALESCE(role, ''))
                                WHEN 'admin' THEN 'Admin'
                                WHEN 'owner' THEN 'Owner'
                                WHEN 'manager' THEN 'Manager'
                                WHEN 'supervisor' THEN 'Supervisor'
                                WHEN 'operator' THEN 'Operator'
                                WHEN 'attendance' THEN 'Attendance'
                                WHEN 'accountant' THEN 'Accountant'
                                ELSE COALESCE(role, 'Operator')
                            END
                            FROM users
                            WHERE users.id = entries.user_id
                        )
                        WHERE department IS NULL OR TRIM(department) = ''
                        """
                    )
                except Exception:
                    pass
                try:
                    conn.exec_driver_sql(
                        """
                        UPDATE entries
                        SET org_id = (
                            SELECT org_id FROM users WHERE users.id = entries.user_id
                        )
                        WHERE org_id IS NULL
                        """
                    )
                except Exception:
                    pass
                try:
                    conn.exec_driver_sql(
                        """
                        UPDATE entries
                        SET factory_id = (
                            SELECT factory_id FROM factories
                            WHERE factories.name = (
                                SELECT factory_name FROM users WHERE users.id = entries.user_id
                            )
                            LIMIT 1
                        )
                        WHERE factory_id IS NULL
                        """
                    )
                except Exception:
                    pass
    except Exception:
        logger.exception("Failed to ensure entries.status column.")


def _ensure_users_columns() -> None:
    """Ensure legacy user columns exist and are safely backfilled."""
    try:
        inspector = inspect(engine)
        columns = {column["name"] for column in inspector.get_columns("users")}
        dialect = engine.dialect.name
        with engine.connect() as conn:
            if "factory_code" not in columns:
                conn.exec_driver_sql("ALTER TABLE users ADD COLUMN factory_code VARCHAR(32)")
            if "org_id" not in columns:
                conn.exec_driver_sql("ALTER TABLE users ADD COLUMN org_id VARCHAR(36)")
            if "google_id" not in columns:
                conn.exec_driver_sql("ALTER TABLE users ADD COLUMN google_id VARCHAR(255)")
            if "profile_picture" not in columns:
                conn.exec_driver_sql("ALTER TABLE users ADD COLUMN profile_picture VARCHAR(500)")
            if "auth_provider" not in columns:
                conn.exec_driver_sql("ALTER TABLE users ADD COLUMN auth_provider VARCHAR(32) DEFAULT 'local'")
            if "is_platform_admin" not in columns:
                if dialect == "postgresql":
                    conn.exec_driver_sql(
                        "ALTER TABLE users ADD COLUMN is_platform_admin BOOLEAN NOT NULL DEFAULT FALSE"
                    )
                else:
                    conn.exec_driver_sql(
                        "ALTER TABLE users ADD COLUMN is_platform_admin BOOLEAN NOT NULL DEFAULT 0"
                    )
            if dialect == "postgresql":
                conn.exec_driver_sql("UPDATE users SET is_platform_admin = FALSE WHERE is_platform_admin IS NULL")
                conn.exec_driver_sql("ALTER TABLE users ALTER COLUMN is_platform_admin SET DEFAULT FALSE")
                conn.exec_driver_sql("ALTER TABLE users ALTER COLUMN is_platform_admin SET NOT NULL")
            else:
                conn.exec_driver_sql("UPDATE users SET is_platform_admin = 0 WHERE is_platform_admin IS NULL")
            conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_users_org_id ON users (org_id)")

            factories = conn.execute(text("SELECT DISTINCT factory_name FROM users")).fetchall()
            for (factory_name,) in factories:
                if not factory_name:
                    continue
                existing = conn.execute(
                    text(
                        "SELECT factory_code FROM users "
                        "WHERE factory_name = :factory_name "
                        "AND factory_code IS NOT NULL AND factory_code != '' "
                        "LIMIT 1"
                    ),
                    {"factory_name": factory_name},
                ).fetchone()
                factory_code = existing[0] if existing else None
                if not factory_code:
                    while True:
                        candidate = generate_company_code()
                        collision = conn.execute(
                            text("SELECT id FROM users WHERE factory_code = :factory_code LIMIT 1"),
                            {"factory_code": candidate},
                        ).fetchone()
                        if not collision:
                            factory_code = candidate
                            break
                conn.execute(
                    text(
                        "UPDATE users SET factory_code = :factory_code "
                        "WHERE factory_name = :factory_name "
                        "AND (factory_code IS NULL OR factory_code = '')"
                    ),
                    {"factory_code": factory_code, "factory_name": factory_name},
                )
            conn.commit()
    except Exception:
        logger.exception("Failed to ensure users columns.")


def _ensure_phone_and_alerting_columns() -> None:
    """Backfill newer phone verification and alerting columns when migrations were skipped."""
    try:
        inspector = inspect(engine)
        table_names = set(inspector.get_table_names())
        dialect = engine.dialect.name
        with engine.connect() as conn:
            _ensure_postgres_enum_value(
                conn,
                enum_name="phone_verification_channel",
                enum_value="whatsapp",
            )
            _ensure_postgres_enum_value(
                conn,
                enum_name="phone_verification_channel",
                enum_value="email",
            )
            _ensure_postgres_enum_value(
                conn,
                enum_name="phone_verification_purpose",
                enum_value="user_verification",
            )
            _ensure_postgres_enum_value(
                conn,
                enum_name="phone_verification_purpose",
                enum_value="alert_recipient",
            )

            if "users" in table_names:
                user_columns = {column["name"] for column in inspector.get_columns("users")}
                if "phone_number" not in user_columns:
                    conn.exec_driver_sql("ALTER TABLE users ADD COLUMN phone_number VARCHAR(32)")
                    user_columns.add("phone_number")
                if "phone_e164" not in user_columns:
                    conn.exec_driver_sql("ALTER TABLE users ADD COLUMN phone_e164 VARCHAR(20)")
                    user_columns.add("phone_e164")
                if "phone_verification_status" not in user_columns:
                    conn.exec_driver_sql(
                        "ALTER TABLE users ADD COLUMN phone_verification_status VARCHAR(24) "
                        "NOT NULL DEFAULT 'pending'"
                    )
                    user_columns.add("phone_verification_status")
                if "phone_verified_at" not in user_columns:
                    conn.exec_driver_sql("ALTER TABLE users ADD COLUMN phone_verified_at TIMESTAMP")
                    user_columns.add("phone_verified_at")
                if "phone_last_otp_sent_at" not in user_columns:
                    conn.exec_driver_sql("ALTER TABLE users ADD COLUMN phone_last_otp_sent_at TIMESTAMP")
                    user_columns.add("phone_last_otp_sent_at")
                if "phone_otp_attempts" not in user_columns:
                    conn.exec_driver_sql(
                        "ALTER TABLE users ADD COLUMN phone_otp_attempts INTEGER NOT NULL DEFAULT 0"
                    )
                    user_columns.add("phone_otp_attempts")
                conn.exec_driver_sql(
                    "UPDATE users SET phone_e164 = phone_number "
                    "WHERE phone_e164 IS NULL AND phone_number IS NOT NULL AND TRIM(phone_number) != ''"
                )
                conn.exec_driver_sql(
                    "UPDATE users SET phone_verification_status = 'pending' "
                    "WHERE phone_verification_status IS NULL OR TRIM(CAST(phone_verification_status AS TEXT)) = ''"
                )
                conn.exec_driver_sql(
                    "UPDATE users SET phone_otp_attempts = 0 WHERE phone_otp_attempts IS NULL"
                )

            if "admin_alert_recipients" in table_names:
                recipient_columns = {column["name"] for column in inspector.get_columns("admin_alert_recipients")}
                if "phone_e164" not in recipient_columns:
                    conn.exec_driver_sql("ALTER TABLE admin_alert_recipients ADD COLUMN phone_e164 VARCHAR(20)")
                if "verification_status" not in recipient_columns:
                    conn.exec_driver_sql(
                        "ALTER TABLE admin_alert_recipients ADD COLUMN verification_status VARCHAR(24) "
                        "NOT NULL DEFAULT 'pending'"
                    )
                if "verified_at" not in recipient_columns:
                    conn.exec_driver_sql("ALTER TABLE admin_alert_recipients ADD COLUMN verified_at TIMESTAMP")
                if "verified_by_user_id" not in recipient_columns:
                    conn.exec_driver_sql("ALTER TABLE admin_alert_recipients ADD COLUMN verified_by_user_id INTEGER")
                if "otp_attempts" not in recipient_columns:
                    conn.exec_driver_sql(
                        "ALTER TABLE admin_alert_recipients ADD COLUMN otp_attempts INTEGER NOT NULL DEFAULT 0"
                    )
                if "last_otp_sent_at" not in recipient_columns:
                    conn.exec_driver_sql(
                        "ALTER TABLE admin_alert_recipients ADD COLUMN last_otp_sent_at TIMESTAMP"
                    )
                if "event_types" not in recipient_columns:
                    if dialect == "postgresql":
                        conn.exec_driver_sql("ALTER TABLE admin_alert_recipients ADD COLUMN event_types JSONB")
                    else:
                        conn.exec_driver_sql("ALTER TABLE admin_alert_recipients ADD COLUMN event_types JSON")
                if "severity_levels" not in recipient_columns:
                    if dialect == "postgresql":
                        conn.exec_driver_sql("ALTER TABLE admin_alert_recipients ADD COLUMN severity_levels JSONB")
                    else:
                        conn.exec_driver_sql("ALTER TABLE admin_alert_recipients ADD COLUMN severity_levels JSON")
                if "receive_daily_summary" not in recipient_columns:
                    conn.exec_driver_sql(
                        "ALTER TABLE admin_alert_recipients ADD COLUMN receive_daily_summary BOOLEAN NOT NULL DEFAULT TRUE"
                    )
                conn.exec_driver_sql(
                    "UPDATE admin_alert_recipients SET phone_e164 = phone_number "
                    "WHERE phone_e164 IS NULL AND phone_number IS NOT NULL AND TRIM(phone_number) != ''"
                )
                conn.exec_driver_sql(
                    "UPDATE admin_alert_recipients SET verification_status = 'pending' "
                    "WHERE verification_status IS NULL OR TRIM(verification_status) = ''"
                )
                conn.exec_driver_sql(
                    "UPDATE admin_alert_recipients SET otp_attempts = 0 WHERE otp_attempts IS NULL"
                )
                conn.exec_driver_sql(
                    "UPDATE admin_alert_recipients SET receive_daily_summary = TRUE "
                    "WHERE receive_daily_summary IS NULL"
                )

            if "ops_alert_events" in table_names:
                alert_columns = {column["name"] for column in inspector.get_columns("ops_alert_events")}
                if "org_id" not in alert_columns:
                    conn.exec_driver_sql("ALTER TABLE ops_alert_events ADD COLUMN org_id VARCHAR(36)")
                if "org_name" not in alert_columns:
                    conn.exec_driver_sql("ALTER TABLE ops_alert_events ADD COLUMN org_name VARCHAR(200)")
                if "status" not in alert_columns:
                    conn.exec_driver_sql(
                        "ALTER TABLE ops_alert_events ADD COLUMN status VARCHAR(24) NOT NULL DEFAULT 'queued'"
                    )
                if "group_key" not in alert_columns:
                    conn.exec_driver_sql("ALTER TABLE ops_alert_events ADD COLUMN group_key VARCHAR(255)")
                if "escalation_level" not in alert_columns:
                    conn.exec_driver_sql(
                        "ALTER TABLE ops_alert_events ADD COLUMN escalation_level INTEGER NOT NULL DEFAULT 0"
                    )
                if "is_summary" not in alert_columns:
                    conn.exec_driver_sql(
                        "ALTER TABLE ops_alert_events ADD COLUMN is_summary BOOLEAN NOT NULL DEFAULT FALSE"
                    )
                if "recipient_phone" not in alert_columns:
                    conn.exec_driver_sql("ALTER TABLE ops_alert_events ADD COLUMN recipient_phone VARCHAR(48)")
                if "suppressed_reason" not in alert_columns:
                    conn.exec_driver_sql("ALTER TABLE ops_alert_events ADD COLUMN suppressed_reason VARCHAR(64)")
                if "provider_message_id" not in alert_columns:
                    conn.exec_driver_sql("ALTER TABLE ops_alert_events ADD COLUMN provider_message_id VARCHAR(255)")
                if "provider_status_at" not in alert_columns:
                    conn.exec_driver_sql("ALTER TABLE ops_alert_events ADD COLUMN provider_status_at TIMESTAMP")
                if "delivered_at" not in alert_columns:
                    conn.exec_driver_sql("ALTER TABLE ops_alert_events ADD COLUMN delivered_at TIMESTAMP")
                if "read_at" not in alert_columns:
                    conn.exec_driver_sql("ALTER TABLE ops_alert_events ADD COLUMN read_at TIMESTAMP")
                if "failed_at" not in alert_columns:
                    conn.exec_driver_sql("ALTER TABLE ops_alert_events ADD COLUMN failed_at TIMESTAMP")
                if "provider_error_code" not in alert_columns:
                    conn.exec_driver_sql("ALTER TABLE ops_alert_events ADD COLUMN provider_error_code VARCHAR(64)")
                if "provider_error_title" not in alert_columns:
                    conn.exec_driver_sql("ALTER TABLE ops_alert_events ADD COLUMN provider_error_title VARCHAR(255)")
                conn.exec_driver_sql(
                    "UPDATE ops_alert_events SET status = 'queued' WHERE status IS NULL OR TRIM(status) = ''"
                )
                conn.exec_driver_sql(
                    "UPDATE ops_alert_events SET escalation_level = 0 WHERE escalation_level IS NULL"
                )
                conn.exec_driver_sql(
                    "UPDATE ops_alert_events SET is_summary = FALSE WHERE is_summary IS NULL"
                )
                conn.exec_driver_sql(
                    "CREATE INDEX IF NOT EXISTS ix_ops_alert_events_org_created_at "
                    "ON ops_alert_events (org_id, created_at)"
                )
                conn.exec_driver_sql(
                    "CREATE INDEX IF NOT EXISTS ix_ops_alert_events_org_created_at_desc "
                    "ON ops_alert_events (org_id, created_at DESC)"
                )
                conn.exec_driver_sql(
                    "CREATE INDEX IF NOT EXISTS ix_ops_alert_events_provider_message_id "
                    "ON ops_alert_events (provider_message_id)"
                )
                conn.exec_driver_sql(
                    "CREATE INDEX IF NOT EXISTS ix_ops_alert_events_ref_id ON ops_alert_events (ref_id)"
                )

            if "phone_verifications" not in table_names:
                conn.exec_driver_sql(
                    """
                    CREATE TABLE phone_verifications (
                        id VARCHAR(36) PRIMARY KEY,
                        phone_e164 VARCHAR(20) NOT NULL,
                        otp_hash VARCHAR(72) NOT NULL,
                        expires_at TIMESTAMP NOT NULL,
                        attempts INTEGER NOT NULL DEFAULT 0,
                        used BOOLEAN NOT NULL DEFAULT FALSE,
                        channel VARCHAR(24) NOT NULL,
                        purpose VARCHAR(40) NOT NULL,
                        user_id INTEGER NULL REFERENCES users (id),
                        recipient_id INTEGER NULL REFERENCES admin_alert_recipients (id),
                        created_at TIMESTAMP NOT NULL
                    )
                    """
                )
            conn.exec_driver_sql(
                "UPDATE phone_verifications SET channel = 'whatsapp' "
                "WHERE channel IS NOT NULL AND LOWER(TRIM(CAST(channel AS TEXT))) = 'sms'"
            )
            conn.exec_driver_sql(
                "CREATE INDEX IF NOT EXISTS ix_phone_verifications_phone_purpose_active "
                "ON phone_verifications (phone_e164, purpose, used, expires_at)"
            )
            conn.exec_driver_sql(
                "CREATE INDEX IF NOT EXISTS ix_phone_verifications_user_id ON phone_verifications (user_id)"
            )
            conn.exec_driver_sql(
                "CREATE INDEX IF NOT EXISTS ix_phone_verifications_recipient_id "
                "ON phone_verifications (recipient_id)"
            )

            conn.commit()
    except Exception:
        logger.exception("Failed to ensure phone verification and alerting columns.")


def _ensure_workforce_tables() -> None:
    """Create workforce and master-data tables that may have been missed on first deploy."""
    try:
        inspector = inspect(engine)
        table_names = set(inspector.get_table_names())
        with engine.connect() as conn:
            if "workforce_cost_rates" not in table_names:
                conn.exec_driver_sql(
                    """
                    CREATE TABLE workforce_cost_rates (
                        id SERIAL PRIMARY KEY,
                        org_id VARCHAR(36) NOT NULL REFERENCES organizations(org_id),
                        factory_id VARCHAR(36) NOT NULL REFERENCES factories(factory_id),
                        user_id INTEGER REFERENCES users(id),
                        role VARCHAR(32),
                        department VARCHAR(120),
                        effective_from DATE NOT NULL,
                        effective_to DATE,
                        regular_hourly_rate_inr NUMERIC(10, 2) NOT NULL DEFAULT 0,
                        overtime_multiplier NUMERIC(4, 2) NOT NULL DEFAULT 1.5,
                        is_active BOOLEAN NOT NULL DEFAULT TRUE,
                        notes VARCHAR(300),
                        created_by_user_id INTEGER REFERENCES users(id),
                        created_at TIMESTAMP WITH TIME ZONE NOT NULL,
                        updated_at TIMESTAMP WITH TIME ZONE NOT NULL
                    )
                    """
                )
                conn.exec_driver_sql(
                    "CREATE INDEX IF NOT EXISTS ix_wc_rates_factory_effective ON workforce_cost_rates (factory_id, effective_from)"
                )
                conn.exec_driver_sql(
                    "CREATE INDEX IF NOT EXISTS ix_wc_rates_user_effective ON workforce_cost_rates (user_id, effective_from)"
                )
                conn.exec_driver_sql(
                    "CREATE INDEX IF NOT EXISTS ix_workforce_cost_rates_org_id ON workforce_cost_rates (org_id)"
                )
                logger.info("Created missing table: workforce_cost_rates")

            if "defect_reason" not in table_names:
                conn.exec_driver_sql(
                    """
                    CREATE TABLE defect_reason (
                        id SERIAL PRIMARY KEY,
                        code VARCHAR(60) NOT NULL UNIQUE,
                        label VARCHAR(120) NOT NULL,
                        description TEXT,
                        is_active BOOLEAN NOT NULL DEFAULT TRUE,
                        created_at TIMESTAMP WITH TIME ZONE NOT NULL
                    )
                    """
                )
                logger.info("Created missing table: defect_reason")
            conn.commit()
    except Exception:
        logger.exception("Failed to ensure workforce/master-data tables.")


def _ensure_feedback_columns() -> None:
    """Backfill newer feedback columns for databases that skipped migrations."""
    try:
        inspector = inspect(engine)
        table_names = set(inspector.get_table_names())
        if "feedback" not in table_names:
            return
        columns = {column["name"] for column in inspector.get_columns("feedback")}
        with engine.connect() as conn:
            if "rating" not in columns:
                conn.exec_driver_sql("ALTER TABLE feedback ADD COLUMN rating VARCHAR(16)")
            conn.commit()
    except Exception:
        logger.exception("Failed to ensure feedback columns.")


def _ensure_auth_email_columns() -> None:
    """Ensure live users support email verification without locking legacy accounts out."""
    try:
        inspector = inspect(engine)
        columns = {column["name"] for column in inspector.get_columns("users")}
        with engine.connect() as conn:
            if "email_verified_at" not in columns:
                conn.exec_driver_sql("ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMP")
            if "verification_sent_at" not in columns:
                conn.exec_driver_sql("ALTER TABLE users ADD COLUMN verification_sent_at TIMESTAMP")

            conn.execute(
                text(
                    """
                    UPDATE users
                    SET email_verified_at = created_at
                    WHERE email_verified_at IS NULL
                      AND verification_sent_at IS NULL
                    """
                )
            )
            conn.commit()
    except Exception:
        logger.exception("Failed to ensure users email verification columns.")


def _ensure_org_factory_backfill() -> None:
    """Backfill orgs/factories for legacy users missing org_id (sqlite-friendly)."""
    try:
        from backend.plans import DEFAULT_PLAN

        now = datetime.now(timezone.utc)
        with engine.connect() as conn:
            factories = conn.execute(
                text(
                    """
                    SELECT DISTINCT factory_name
                    FROM users
                    WHERE factory_name IS NOT NULL
                    AND TRIM(factory_name) != ''
                    """
                )
            ).fetchall()

            for (factory_name,) in factories:
                org_row = conn.execute(
                    text(
                        """
                        SELECT org_id FROM users
                        WHERE factory_name = :factory_name
                        AND org_id IS NOT NULL AND org_id != ''
                        LIMIT 1
                        """
                    ),
                    {"factory_name": factory_name},
                ).fetchone()
                org_id = org_row[0] if org_row else None

                if not org_id:
                    org_row = conn.execute(
                        text("SELECT org_id FROM organizations WHERE name = :name LIMIT 1"),
                        {"name": factory_name},
                    ).fetchone()
                    org_id = org_row[0] if org_row else None

                if not org_id:
                    org_id = str(uuid.uuid4())
                    conn.execute(
                        text(
                            """
                            INSERT INTO organizations (org_id, name, plan, created_at, is_active)
                            VALUES (:org_id, :name, :plan, :created_at, 1)
                            """
                        ),
                        {
                            "org_id": org_id,
                            "name": factory_name,
                            "plan": DEFAULT_PLAN,
                            "created_at": now,
                        },
                    )

                factory_row = conn.execute(
                    text(
                        """
                        SELECT factory_id FROM factories
                        WHERE org_id = :org_id AND name = :name
                        LIMIT 1
                        """
                    ),
                    {"org_id": org_id, "name": factory_name},
                ).fetchone()
                factory_id = factory_row[0] if factory_row else None
                if not factory_id:
                    factory_id = str(uuid.uuid4())
                    conn.execute(
                        text(
                            """
                            INSERT INTO factories (factory_id, org_id, name, timezone, created_at, is_active)
                            VALUES (:factory_id, :org_id, :name, :timezone, :created_at, 1)
                            """
                        ),
                        {
                            "factory_id": factory_id,
                            "org_id": org_id,
                            "name": factory_name,
                            "timezone": "Asia/Kolkata",
                            "created_at": now,
                        },
                    )

                conn.execute(
                    text(
                        """
                        UPDATE users
                        SET org_id = :org_id
                        WHERE factory_name = :factory_name
                        AND (org_id IS NULL OR org_id = '')
                        """
                    ),
                    {"org_id": org_id, "factory_name": factory_name},
                )

                user_rows = conn.execute(
                    text(
                        """
                        SELECT id, role FROM users
                        WHERE factory_name = :factory_name
                        AND is_active IS 1
                        """
                    ),
                    {"factory_name": factory_name},
                ).fetchall()
                for user_id, role in user_rows:
                    exists = conn.execute(
                        text(
                            """
                            SELECT id FROM user_factory_roles
                            WHERE user_id = :user_id AND factory_id = :factory_id
                            LIMIT 1
                            """
                        ),
                        {"user_id": user_id, "factory_id": factory_id},
                    ).fetchone()
                    if not exists:
                        conn.execute(
                            text(
                                """
                                INSERT INTO user_factory_roles (id, user_id, factory_id, org_id, role, assigned_at)
                                VALUES (:id, :user_id, :factory_id, :org_id, :role, :assigned_at)
                                """
                            ),
                            {
                                "id": str(uuid.uuid4()),
                                "user_id": user_id,
                                "factory_id": factory_id,
                                "org_id": org_id,
                                "role": role,
                                "assigned_at": now,
                            },
                        )
            conn.commit()
    except Exception:
        logger.exception("Failed to backfill org/factory data.")


def _ensure_audit_logs_columns() -> None:
    """Ensure audit_logs new columns and indexes exist (sqlite-friendly)."""
    try:
        with engine.connect() as conn:
            dialect = engine.dialect.name
            if dialect == "sqlite":
                cols = {row[1] for row in conn.exec_driver_sql("PRAGMA table_info(audit_logs)").fetchall()}
                if "org_id" not in cols:
                    conn.exec_driver_sql("ALTER TABLE audit_logs ADD COLUMN org_id VARCHAR(36)")
                if "factory_id" not in cols:
                    conn.exec_driver_sql("ALTER TABLE audit_logs ADD COLUMN factory_id VARCHAR(36)")
                if "user_agent" not in cols:
                    conn.exec_driver_sql("ALTER TABLE audit_logs ADD COLUMN user_agent VARCHAR(500)")
                conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_audit_logs_org_id ON audit_logs (org_id)")
            else:
                try:
                    conn.exec_driver_sql("ALTER TABLE audit_logs ADD COLUMN org_id VARCHAR(36)")
                except Exception:
                    pass
                try:
                    conn.exec_driver_sql("ALTER TABLE audit_logs ADD COLUMN factory_id VARCHAR(36)")
                except Exception:
                    pass
                try:
                    conn.exec_driver_sql("ALTER TABLE audit_logs ADD COLUMN user_agent VARCHAR(500)")
                except Exception:
                    pass
                try:
                    conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_audit_logs_org_id ON audit_logs (org_id)")
                except Exception:
                    pass
            conn.commit()
    except Exception:
        logger.exception("Failed to ensure audit_logs columns.")
