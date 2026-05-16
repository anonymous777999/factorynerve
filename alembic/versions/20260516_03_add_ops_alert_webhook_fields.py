"""Add webhook reconciliation fields to ops_alert_events.

Revision ID: 20260516_03
Revises: 20260516_02
Create Date: 2026-05-16
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260516_03"
down_revision = "20260516_02"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_names = set(inspector.get_table_names())
    if "ops_alert_events" not in table_names:
        return

    columns = {column["name"] for column in inspector.get_columns("ops_alert_events")}

    if "provider_message_id" not in columns:
        op.add_column("ops_alert_events", sa.Column("provider_message_id", sa.String(length=255), nullable=True))
    if "provider_status_at" not in columns:
        op.add_column("ops_alert_events", sa.Column("provider_status_at", sa.DateTime(timezone=True), nullable=True))
    if "delivered_at" not in columns:
        op.add_column("ops_alert_events", sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True))
    if "read_at" not in columns:
        op.add_column("ops_alert_events", sa.Column("read_at", sa.DateTime(timezone=True), nullable=True))
    if "failed_at" not in columns:
        op.add_column("ops_alert_events", sa.Column("failed_at", sa.DateTime(timezone=True), nullable=True))
    if "provider_error_code" not in columns:
        op.add_column("ops_alert_events", sa.Column("provider_error_code", sa.String(length=64), nullable=True))
    if "provider_error_title" not in columns:
        op.add_column("ops_alert_events", sa.Column("provider_error_title", sa.String(length=255), nullable=True))

    existing_indexes = {index["name"] for index in inspector.get_indexes("ops_alert_events")}
    if "ix_ops_alert_events_provider_message_id" not in existing_indexes:
        op.create_index(
            "ix_ops_alert_events_provider_message_id",
            "ops_alert_events",
            ["provider_message_id"],
            unique=False,
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_names = set(inspector.get_table_names())
    if "ops_alert_events" not in table_names:
        return

    columns = {column["name"] for column in inspector.get_columns("ops_alert_events")}
    existing_indexes = {index["name"] for index in inspector.get_indexes("ops_alert_events")}
    if "ix_ops_alert_events_provider_message_id" in existing_indexes:
        op.drop_index("ix_ops_alert_events_provider_message_id", table_name="ops_alert_events")

    for column_name in (
        "provider_error_title",
        "provider_error_code",
        "failed_at",
        "read_at",
        "delivered_at",
        "provider_status_at",
        "provider_message_id",
    ):
        if column_name in columns:
            op.drop_column("ops_alert_events", column_name)
