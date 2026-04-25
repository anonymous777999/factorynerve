"""Add standalone WhatsApp alert recipients, preferences, and logs.

Revision ID: 20260425_01
Revises: 20260424_02
Create Date: 2026-04-25
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260425_01"
down_revision = "20260424_02"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_names = set(inspector.get_table_names())

    if "alert_recipients" not in table_names:
        op.create_table(
            "alert_recipients",
            sa.Column("id", sa.Integer(), nullable=False, primary_key=True, autoincrement=True),
            sa.Column("name", sa.String(length=120), nullable=False),
            sa.Column("phone_e164", sa.String(length=20), nullable=False),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.UniqueConstraint("phone_e164", name="uq_alert_recipients_phone_e164"),
        )
    existing_recipient_indexes = {index["name"] for index in inspector.get_indexes("alert_recipients")}
    if "ix_alert_recipients_phone_e164" not in existing_recipient_indexes:
        op.create_index("ix_alert_recipients_phone_e164", "alert_recipients", ["phone_e164"], unique=False)
    if "ix_alert_recipients_is_active" not in existing_recipient_indexes:
        op.create_index("ix_alert_recipients_is_active", "alert_recipients", ["is_active"], unique=False)
    if "ix_alert_recipients_created_at" not in existing_recipient_indexes:
        op.create_index("ix_alert_recipients_created_at", "alert_recipients", ["created_at"], unique=False)

    if "alert_preferences" not in table_names:
        op.create_table(
            "alert_preferences",
            sa.Column("id", sa.Integer(), nullable=False, primary_key=True, autoincrement=True),
            sa.Column("recipient_id", sa.Integer(), nullable=False),
            sa.Column("alert_type", sa.String(length=80), nullable=False),
            sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.ForeignKeyConstraint(["recipient_id"], ["alert_recipients.id"], ondelete="CASCADE"),
            sa.UniqueConstraint("recipient_id", "alert_type", name="uq_alert_preferences_recipient_alert_type"),
        )
    existing_preference_indexes = {index["name"] for index in inspector.get_indexes("alert_preferences")}
    if "ix_alert_preferences_recipient_id" not in existing_preference_indexes:
        op.create_index("ix_alert_preferences_recipient_id", "alert_preferences", ["recipient_id"], unique=False)
    if "ix_alert_preferences_alert_type" not in existing_preference_indexes:
        op.create_index("ix_alert_preferences_alert_type", "alert_preferences", ["alert_type"], unique=False)

    if "alert_logs" not in table_names:
        op.create_table(
            "alert_logs",
            sa.Column("id", sa.Integer(), nullable=False, primary_key=True, autoincrement=True),
            sa.Column("recipient_id", sa.Integer(), nullable=False),
            sa.Column("alert_type", sa.String(length=80), nullable=False),
            sa.Column("message", sa.Text(), nullable=False),
            sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
            sa.Column("provider", sa.String(length=32), nullable=True),
            sa.Column("provider_message_id", sa.String(length=255), nullable=True),
            sa.Column("provider_response", sa.JSON(), nullable=True),
            sa.Column("failure_reason", sa.Text(), nullable=True),
            sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["recipient_id"], ["alert_recipients.id"], ondelete="CASCADE"),
        )
    existing_log_indexes = {index["name"] for index in inspector.get_indexes("alert_logs")}
    if "ix_alert_logs_recipient_id" not in existing_log_indexes:
        op.create_index("ix_alert_logs_recipient_id", "alert_logs", ["recipient_id"], unique=False)
    if "ix_alert_logs_status" not in existing_log_indexes:
        op.create_index("ix_alert_logs_status", "alert_logs", ["status"], unique=False)
    if "ix_alert_logs_created_at" not in existing_log_indexes:
        op.create_index("ix_alert_logs_created_at", "alert_logs", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_alert_logs_created_at", table_name="alert_logs")
    op.drop_index("ix_alert_logs_status", table_name="alert_logs")
    op.drop_index("ix_alert_logs_recipient_id", table_name="alert_logs")
    op.drop_table("alert_logs")

    op.drop_index("ix_alert_preferences_alert_type", table_name="alert_preferences")
    op.drop_index("ix_alert_preferences_recipient_id", table_name="alert_preferences")
    op.drop_table("alert_preferences")

    op.drop_index("ix_alert_recipients_created_at", table_name="alert_recipients")
    op.drop_index("ix_alert_recipients_is_active", table_name="alert_recipients")
    op.drop_index("ix_alert_recipients_phone_e164", table_name="alert_recipients")
    op.drop_table("alert_recipients")
