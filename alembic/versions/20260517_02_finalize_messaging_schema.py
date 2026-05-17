"""Finalize canonical messaging schema for OTP and WhatsApp delivery.

Revision ID: 20260517_02
Revises: 20260517_01
Create Date: 2026-05-17
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260517_02"
down_revision = "20260517_01"
branch_labels = None
depends_on = None


_REQUIRED_OPS_ALERT_COLUMNS: dict[str, sa.Column] = {
    "org_id": sa.Column("org_id", sa.String(length=36), nullable=True),
    "org_name": sa.Column("org_name", sa.String(length=200), nullable=True),
    "status": sa.Column("status", sa.String(length=24), nullable=False, server_default="queued"),
    "group_key": sa.Column("group_key", sa.String(length=255), nullable=True),
    "escalation_level": sa.Column("escalation_level", sa.Integer(), nullable=False, server_default="0"),
    "is_summary": sa.Column("is_summary", sa.Boolean(), nullable=False, server_default=sa.false()),
    "recipient_phone": sa.Column("recipient_phone", sa.String(length=48), nullable=True),
    "suppressed_reason": sa.Column("suppressed_reason", sa.String(length=64), nullable=True),
    "provider_message_id": sa.Column("provider_message_id", sa.String(length=255), nullable=True),
    "provider_status_at": sa.Column("provider_status_at", sa.DateTime(timezone=True), nullable=True),
    "delivered_at": sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
    "read_at": sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
    "failed_at": sa.Column("failed_at", sa.DateTime(timezone=True), nullable=True),
    "provider_error_code": sa.Column("provider_error_code", sa.String(length=64), nullable=True),
    "provider_error_title": sa.Column("provider_error_title", sa.String(length=255), nullable=True),
}


def _table_names(bind: sa.engine.Connection) -> set[str]:
    return set(sa.inspect(bind).get_table_names())


def _column_names(bind: sa.engine.Connection, table_name: str) -> set[str]:
    return {column["name"] for column in sa.inspect(bind).get_columns(table_name)}


def _ensure_postgres_enum_values(bind: sa.engine.Connection, *, enum_name: str, values: set[str]) -> None:
    if bind.dialect.name != "postgresql":
        return

    labels = {
        str(label).strip()
        for label in bind.execute(
            sa.text(
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
    if not labels:
        return

    for value in sorted(values - labels):
        bind.exec_driver_sql(f"ALTER TYPE {enum_name} ADD VALUE IF NOT EXISTS '{value}'")


def _add_column_if_missing(table_name: str, column_name: str, column: sa.Column) -> None:
    bind = op.get_bind()
    if table_name not in _table_names(bind):
        return
    if column_name in _column_names(bind, table_name):
        return
    op.add_column(table_name, column)


def upgrade() -> None:
    bind = op.get_bind()
    table_names = _table_names(bind)

    _ensure_postgres_enum_values(
        bind,
        enum_name="phone_verification_channel",
        values={"whatsapp", "email"},
    )
    _ensure_postgres_enum_values(
        bind,
        enum_name="phone_verification_purpose",
        values={"user_verification", "alert_recipient"},
    )

    if "phone_verifications" in table_names:
        bind.execute(
            sa.text(
                """
                UPDATE phone_verifications
                SET channel = 'whatsapp'
                WHERE channel IS NOT NULL
                  AND LOWER(TRIM(CAST(channel AS TEXT))) = 'sms'
                """
            )
        )

    if "ops_alert_events" in table_names:
        for column_name, column in _REQUIRED_OPS_ALERT_COLUMNS.items():
            _add_column_if_missing("ops_alert_events", column_name, column)

        bind.execute(
            sa.text(
                """
                UPDATE ops_alert_events
                SET status = 'queued'
                WHERE status IS NULL OR TRIM(CAST(status AS TEXT)) = ''
                """
            )
        )
        bind.execute(sa.text("UPDATE ops_alert_events SET escalation_level = 0 WHERE escalation_level IS NULL"))
        bind.execute(sa.text("UPDATE ops_alert_events SET is_summary = FALSE WHERE is_summary IS NULL"))

        bind.exec_driver_sql(
            "CREATE INDEX IF NOT EXISTS ix_ops_alert_events_ref_id ON ops_alert_events (ref_id)"
        )
        bind.exec_driver_sql(
            "CREATE INDEX IF NOT EXISTS ix_ops_alert_events_event_type ON ops_alert_events (event_type)"
        )
        bind.exec_driver_sql(
            "CREATE INDEX IF NOT EXISTS ix_ops_alert_events_delivery_status ON ops_alert_events (delivery_status)"
        )
        bind.exec_driver_sql(
            "CREATE INDEX IF NOT EXISTS ix_ops_alert_events_provider_message_id "
            "ON ops_alert_events (provider_message_id)"
        )
        bind.exec_driver_sql(
            "CREATE INDEX IF NOT EXISTS ix_ops_alert_events_created_at ON ops_alert_events (created_at)"
        )
        bind.exec_driver_sql(
            "CREATE INDEX IF NOT EXISTS ix_ops_alert_events_org_created_at "
            "ON ops_alert_events (org_id, created_at)"
        )
        bind.exec_driver_sql(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_ops_alert_events_ref_recipient "
            "ON ops_alert_events (ref_id, recipient_phone)"
        )


def downgrade() -> None:
    pass
