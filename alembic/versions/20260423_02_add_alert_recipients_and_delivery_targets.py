"""Add admin alert recipients and per-recipient ops alert delivery tracking.

Revision ID: 20260423_02
Revises: 20260423_01
Create Date: 2026-04-23
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260423_02"
down_revision = "20260423_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_names = set(inspector.get_table_names())

    if "admin_alert_recipients" not in table_names:
        op.create_table(
            "admin_alert_recipients",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
            sa.Column("org_id", sa.String(length=36), sa.ForeignKey("organizations.org_id"), nullable=False),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("phone_number", sa.String(length=32), nullable=False),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.UniqueConstraint("org_id", "phone_number", name="uq_admin_alert_recipients_org_phone"),
        )

    existing_indexes = {index["name"] for index in inspector.get_indexes("admin_alert_recipients")}
    if "ix_admin_alert_recipients_org_id" not in existing_indexes:
        op.create_index("ix_admin_alert_recipients_org_id", "admin_alert_recipients", ["org_id"], unique=False)
    if "ix_admin_alert_recipients_user_id" not in existing_indexes:
        op.create_index("ix_admin_alert_recipients_user_id", "admin_alert_recipients", ["user_id"], unique=False)
    if "ix_admin_alert_recipients_is_active" not in existing_indexes:
        op.create_index("ix_admin_alert_recipients_is_active", "admin_alert_recipients", ["is_active"], unique=False)

    alert_columns = {column["name"] for column in inspector.get_columns("ops_alert_events")}
    if "recipient_phone" not in alert_columns:
        op.add_column("ops_alert_events", sa.Column("recipient_phone", sa.String(length=48), nullable=True))
    op.execute("DROP INDEX IF EXISTS ix_ops_alert_events_ref_id")
    op.execute("CREATE INDEX IF NOT EXISTS ix_ops_alert_events_ref_id ON ops_alert_events (ref_id)")
    unique_constraints = {constraint["name"] for constraint in inspector.get_unique_constraints("ops_alert_events")}
    if "uq_ops_alert_events_ref_recipient" not in unique_constraints:
        op.create_unique_constraint(
            "uq_ops_alert_events_ref_recipient",
            "ops_alert_events",
            ["ref_id", "recipient_phone"],
        )


def downgrade() -> None:
    op.drop_constraint("uq_ops_alert_events_ref_recipient", "ops_alert_events", type_="unique")
    op.drop_index("ix_ops_alert_events_ref_id", table_name="ops_alert_events")
    op.create_index("ix_ops_alert_events_ref_id", "ops_alert_events", ["ref_id"], unique=True)
    op.drop_column("ops_alert_events", "recipient_phone")

    op.drop_index("ix_admin_alert_recipients_is_active", table_name="admin_alert_recipients")
    op.drop_index("ix_admin_alert_recipients_user_id", table_name="admin_alert_recipients")
    op.drop_index("ix_admin_alert_recipients_org_id", table_name="admin_alert_recipients")
    op.drop_table("admin_alert_recipients")
