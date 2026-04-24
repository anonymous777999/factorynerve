"""Harden ops alerts with preferences, suppression visibility, and summaries.

Revision ID: 20260424_01
Revises: 20260423_02
Create Date: 2026-04-24
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260424_01"
down_revision = "20260423_02"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_names = set(inspector.get_table_names())

    recipient_columns = {column["name"] for column in inspector.get_columns("admin_alert_recipients")}
    if "event_types" not in recipient_columns:
        op.add_column("admin_alert_recipients", sa.Column("event_types", sa.JSON(), nullable=True))
    if "severity_levels" not in recipient_columns:
        op.add_column("admin_alert_recipients", sa.Column("severity_levels", sa.JSON(), nullable=True))
    if "receive_daily_summary" not in recipient_columns:
        op.add_column(
            "admin_alert_recipients",
            sa.Column("receive_daily_summary", sa.Boolean(), nullable=False, server_default=sa.true()),
        )

    alert_columns = {column["name"] for column in inspector.get_columns("ops_alert_events")}
    if "org_id" not in alert_columns:
        op.add_column("ops_alert_events", sa.Column("org_id", sa.String(length=36), nullable=True))
    if "org_name" not in alert_columns:
        op.add_column("ops_alert_events", sa.Column("org_name", sa.String(length=200), nullable=True))
    if "status" not in alert_columns:
        op.add_column("ops_alert_events", sa.Column("status", sa.String(length=24), nullable=False, server_default="queued"))
    if "group_key" not in alert_columns:
        op.add_column("ops_alert_events", sa.Column("group_key", sa.String(length=255), nullable=True))
    if "escalation_level" not in alert_columns:
        op.add_column("ops_alert_events", sa.Column("escalation_level", sa.Integer(), nullable=False, server_default="0"))
    if "is_summary" not in alert_columns:
        op.add_column("ops_alert_events", sa.Column("is_summary", sa.Boolean(), nullable=False, server_default=sa.false()))
    if "suppressed_reason" not in alert_columns:
        op.add_column("ops_alert_events", sa.Column("suppressed_reason", sa.String(length=64), nullable=True))
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_ops_alert_events_org_created_at "
        "ON ops_alert_events (org_id, created_at)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_ops_alert_events_org_created_at_desc "
        "ON ops_alert_events (org_id, created_at DESC)"
    )

    if "ops_alert_daily_summaries" not in table_names:
        op.create_table(
            "ops_alert_daily_summaries",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
            sa.Column("org_id", sa.String(length=36), nullable=False),
            sa.Column("org_name", sa.String(length=200), nullable=True),
            sa.Column("summary_date", sa.Date(), nullable=False),
            sa.Column("total_alerts", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("critical_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("high_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("top_event_type", sa.String(length=64), nullable=True),
            sa.Column("message_body", sa.Text(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.UniqueConstraint("org_id", "summary_date", name="uq_ops_alert_daily_summaries_org_date"),
        )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_ops_alert_daily_summaries_org_date "
        "ON ops_alert_daily_summaries (org_id, summary_date)"
    )


def downgrade() -> None:
    op.drop_index("ix_ops_alert_daily_summaries_org_date", table_name="ops_alert_daily_summaries")
    op.drop_table("ops_alert_daily_summaries")

    op.execute("DROP INDEX IF EXISTS ix_ops_alert_events_org_created_at_desc")
    op.drop_index("ix_ops_alert_events_org_created_at", table_name="ops_alert_events")
    op.drop_column("ops_alert_events", "suppressed_reason")
    op.drop_column("ops_alert_events", "is_summary")
    op.drop_column("ops_alert_events", "escalation_level")
    op.drop_column("ops_alert_events", "group_key")
    op.drop_column("ops_alert_events", "status")
    op.drop_column("ops_alert_events", "org_name")
    op.drop_column("ops_alert_events", "org_id")

    op.drop_column("admin_alert_recipients", "receive_daily_summary")
    op.drop_column("admin_alert_recipients", "severity_levels")
    op.drop_column("admin_alert_recipients", "event_types")
