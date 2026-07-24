"""add_steel_fraud_alerts

Revision ID: 20260619_07
Revises: 20260619_06
Create Date: 2026-06-19 20:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260619_07"
down_revision = "20260619_06"
branch_labels = None
depends_on = None


def _table_names(bind) -> set[str]:
    return set(sa.inspect(bind).get_table_names())


def upgrade() -> None:
    bind = op.get_bind()
    table_names = _table_names(bind)

    if "steel_fraud_alerts" not in table_names:
        op.create_table(
            "steel_fraud_alerts",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("org_id", sa.String(36), nullable=False),
            sa.Column("factory_id", sa.String(36), nullable=False),
            sa.Column("signal_fingerprint", sa.String(64), nullable=False),
            sa.Column("domain", sa.String(24), nullable=False),
            sa.Column("signal_type", sa.String(64), nullable=False),
            sa.Column("severity", sa.String(16), nullable=False),
            sa.Column("confidence", sa.String(16), nullable=False),
            sa.Column("summary", sa.Text(), nullable=False),
            sa.Column("evidence", sa.JSON(), nullable=True),
            sa.Column("recommended_action", sa.Text(), nullable=True),
            sa.Column("resource_type", sa.String(64), nullable=True),
            sa.Column("resource_id", sa.String(64), nullable=True),
            sa.Column("actor_user_id", sa.Integer(), nullable=True),
            sa.Column("status", sa.String(24), nullable=False, server_default="active"),
            sa.Column("acknowledged_by_user_id", sa.Integer(), nullable=True),
            sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("resolved_by_user_id", sa.Integer(), nullable=True),
            sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("resolution_note", sa.Text(), nullable=True),
            sa.Column("dismissed_reason", sa.String(500), nullable=True),
            sa.Column("is_suppressed", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("suppressed_until", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["org_id"], ["organizations.org_id"],),
            sa.ForeignKeyConstraint(["factory_id"], ["factories.factory_id"],),
            sa.ForeignKeyConstraint(["acknowledged_by_user_id"], ["users.id"],),
            sa.ForeignKeyConstraint(["resolved_by_user_id"], ["users.id"],),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("factory_id", "signal_fingerprint", name="uq_steel_fraud_alert_signal"),
        )
        op.create_index("ix_steel_fraud_alert_factory_status", "steel_fraud_alerts", ["factory_id", "status"])
        op.create_index("ix_steel_fraud_alert_severity", "steel_fraud_alerts", ["severity"])
        op.create_index("ix_steel_fraud_alert_created_at", "steel_fraud_alerts", ["created_at"])
        op.create_index("ix_steel_fraud_alert_org_id", "steel_fraud_alerts", ["org_id"])
        op.create_index("ix_steel_fraud_alert_factory_id", "steel_fraud_alerts", ["factory_id"])


def downgrade() -> None:
    bind = op.get_bind()
    table_names = _table_names(bind)
    if "steel_fraud_alerts" in table_names:
        op.drop_table("steel_fraud_alerts")
