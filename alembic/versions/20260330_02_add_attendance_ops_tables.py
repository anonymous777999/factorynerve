"""Add attendance operations tables and review columns.

Revision ID: 20260330_02
Revises: 20260330_01
Create Date: 2026-03-30
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260330_02"
down_revision = "20260330_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("attendance_records", sa.Column("shift_template_id", sa.Integer(), nullable=True))
    op.add_column(
        "attendance_records",
        sa.Column("review_status", sa.String(length=24), nullable=False, server_default="auto"),
    )
    op.add_column("attendance_records", sa.Column("approved_by_user_id", sa.Integer(), nullable=True))
    op.add_column("attendance_records", sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index(
        "ix_attendance_records_review_status",
        "attendance_records",
        ["review_status"],
        unique=False,
    )

    op.create_table(
        "employee_profiles",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("org_id", sa.String(length=36), sa.ForeignKey("organizations.org_id"), nullable=False),
        sa.Column("factory_id", sa.String(length=36), sa.ForeignKey("factories.factory_id"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("employee_code", sa.String(length=32), nullable=True),
        sa.Column("department", sa.String(length=120), nullable=True),
        sa.Column("designation", sa.String(length=120), nullable=True),
        sa.Column("employment_type", sa.String(length=32), nullable=False, server_default="permanent"),
        sa.Column("reporting_manager_id", sa.Integer(), nullable=True),
        sa.Column("default_shift", sa.String(length=16), nullable=False, server_default="morning"),
        sa.Column("joining_date", sa.Date(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", "factory_id", name="uq_employee_profiles_user_factory"),
    )
    op.create_index("ix_employee_profiles_org_factory", "employee_profiles", ["org_id", "factory_id"])
    op.create_index(
        "ix_employee_profiles_factory_department",
        "employee_profiles",
        ["factory_id", "department"],
    )

    op.create_table(
        "shift_templates",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("org_id", sa.String(length=36), sa.ForeignKey("organizations.org_id"), nullable=False),
        sa.Column("factory_id", sa.String(length=36), sa.ForeignKey("factories.factory_id"), nullable=False),
        sa.Column("shift_name", sa.String(length=64), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
        sa.Column("grace_minutes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("overtime_after_minutes", sa.Integer(), nullable=False, server_default="480"),
        sa.Column("cross_midnight", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("factory_id", "shift_name", name="uq_shift_templates_factory_name"),
    )
    op.create_index("ix_shift_templates_org_factory", "shift_templates", ["org_id", "factory_id"])
    op.create_index("ix_shift_templates_factory_default", "shift_templates", ["factory_id", "is_default"])

    op.create_table(
        "attendance_events",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("org_id", sa.String(length=36), sa.ForeignKey("organizations.org_id"), nullable=False),
        sa.Column("factory_id", sa.String(length=36), sa.ForeignKey("factories.factory_id"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("attendance_record_id", sa.Integer(), nullable=True),
        sa.Column("attendance_date", sa.Date(), nullable=False),
        sa.Column("shift", sa.String(length=16), nullable=True),
        sa.Column("event_type", sa.String(length=8), nullable=False),
        sa.Column("event_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("source", sa.String(length=32), nullable=False, server_default="self-service"),
        sa.Column("device_id", sa.String(length=64), nullable=True),
        sa.Column("gps_lat", sa.Float(), nullable=True),
        sa.Column("gps_lng", sa.Float(), nullable=True),
        sa.Column("selfie_url", sa.String(length=500), nullable=True),
        sa.Column("note", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_attendance_events_org_date", "attendance_events", ["org_id", "attendance_date"])
    op.create_index("ix_attendance_events_factory_date", "attendance_events", ["factory_id", "attendance_date"])
    op.create_index("ix_attendance_events_user_time", "attendance_events", ["user_id", "event_time"])
    op.create_index("ix_attendance_events_record", "attendance_events", ["attendance_record_id"])

    op.create_table(
        "attendance_regularizations",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("org_id", sa.String(length=36), sa.ForeignKey("organizations.org_id"), nullable=False),
        sa.Column("factory_id", sa.String(length=36), sa.ForeignKey("factories.factory_id"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column(
            "attendance_record_id",
            sa.Integer(),
            sa.ForeignKey("attendance_records.id"),
            nullable=False,
        ),
        sa.Column("attendance_date", sa.Date(), nullable=False),
        sa.Column("request_type", sa.String(length=32), nullable=False, server_default="missed_punch"),
        sa.Column("requested_in_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("requested_out_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reason", sa.String(length=500), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False, server_default="pending"),
        sa.Column("reviewer_note", sa.String(length=500), nullable=True),
        sa.Column("reviewed_by_user_id", sa.Integer(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_attendance_regularizations_org_status",
        "attendance_regularizations",
        ["org_id", "status"],
    )
    op.create_index(
        "ix_attendance_regularizations_factory_status",
        "attendance_regularizations",
        ["factory_id", "status"],
    )
    op.create_index(
        "ix_attendance_regularizations_record",
        "attendance_regularizations",
        ["attendance_record_id"],
    )
    op.create_index(
        "ix_attendance_regularizations_user_date",
        "attendance_regularizations",
        ["user_id", "attendance_date"],
    )


def downgrade() -> None:
    op.drop_index("ix_attendance_regularizations_user_date", table_name="attendance_regularizations")
    op.drop_index("ix_attendance_regularizations_record", table_name="attendance_regularizations")
    op.drop_index("ix_attendance_regularizations_factory_status", table_name="attendance_regularizations")
    op.drop_index("ix_attendance_regularizations_org_status", table_name="attendance_regularizations")
    op.drop_table("attendance_regularizations")

    op.drop_index("ix_attendance_events_record", table_name="attendance_events")
    op.drop_index("ix_attendance_events_user_time", table_name="attendance_events")
    op.drop_index("ix_attendance_events_factory_date", table_name="attendance_events")
    op.drop_index("ix_attendance_events_org_date", table_name="attendance_events")
    op.drop_table("attendance_events")

    op.drop_index("ix_shift_templates_factory_default", table_name="shift_templates")
    op.drop_index("ix_shift_templates_org_factory", table_name="shift_templates")
    op.drop_table("shift_templates")

    op.drop_index("ix_employee_profiles_factory_department", table_name="employee_profiles")
    op.drop_index("ix_employee_profiles_org_factory", table_name="employee_profiles")
    op.drop_table("employee_profiles")

    op.drop_index("ix_attendance_records_review_status", table_name="attendance_records")
    op.drop_column("attendance_records", "approved_at")
    op.drop_column("attendance_records", "approved_by_user_id")
    op.drop_column("attendance_records", "review_status")
    op.drop_column("attendance_records", "shift_template_id")
