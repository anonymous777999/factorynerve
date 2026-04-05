"""Add attendance records.

Revision ID: 20260330_01
Revises: 20260328_07
Create Date: 2026-03-30
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260330_01"
down_revision = "20260328_07"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "attendance_records",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("org_id", sa.String(length=36), sa.ForeignKey("organizations.org_id"), nullable=False),
        sa.Column("factory_id", sa.String(length=36), sa.ForeignKey("factories.factory_id"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("attendance_date", sa.Date(), nullable=False),
        sa.Column("shift", sa.String(length=16), nullable=False, server_default="morning"),
        sa.Column("status", sa.String(length=24), nullable=False, server_default="working"),
        sa.Column("source", sa.String(length=32), nullable=False, server_default="self-service"),
        sa.Column("note", sa.String(length=500), nullable=True),
        sa.Column("punch_in_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("punch_out_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("worked_minutes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("late_minutes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("overtime_minutes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", "factory_id", "attendance_date", name="uq_attendance_records_user_factory_date"),
    )
    op.create_index("ix_attendance_records_org_date", "attendance_records", ["org_id", "attendance_date"])
    op.create_index("ix_attendance_records_factory_date", "attendance_records", ["factory_id", "attendance_date"])
    op.create_index("ix_attendance_records_user_date", "attendance_records", ["user_id", "attendance_date"])
    op.create_index("ix_attendance_records_status", "attendance_records", ["status"])


def downgrade() -> None:
    op.drop_index("ix_attendance_records_status", table_name="attendance_records")
    op.drop_index("ix_attendance_records_user_date", table_name="attendance_records")
    op.drop_index("ix_attendance_records_factory_date", table_name="attendance_records")
    op.drop_index("ix_attendance_records_org_date", table_name="attendance_records")
    op.drop_table("attendance_records")
