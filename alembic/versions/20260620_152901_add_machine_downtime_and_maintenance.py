"""add steel_machine_downtime_events and steel_maintenance_tasks tables

Revision ID: 20260620_152901
Revises: 20260619_06
Create Date: 2026-06-20T15:29:01.997446
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "20260620_152901"
down_revision: Union[str, None] = "20260619_06"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # steel_machine_downtime_events
    op.create_table(
        "steel_machine_downtime_events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("org_id", sa.String(), nullable=False),
        sa.Column("factory_id", sa.String(), nullable=False),
        sa.Column("machine_id", sa.Integer(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("duration_minutes", sa.Float(), nullable=True),
        sa.Column("reason_category", sa.String(length=60), nullable=True),
        sa.Column("reason_detail", sa.String(length=500), nullable=True),
        sa.Column("shift", sa.String(length=16), nullable=True),
        sa.Column("operator_user_id", sa.Integer(), nullable=True),
        sa.Column("entry_id", sa.Integer(), nullable=True),
        sa.Column("notes", sa.String(length=500), nullable=True),
        sa.Column("created_by_user_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["machine_id"], ["steel_machines.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_steel_machine_downtime_events_machine_id"), "steel_machine_downtime_events", ["machine_id"])
    op.create_index(op.f("ix_steel_machine_downtime_events_factory_id"), "steel_machine_downtime_events", ["factory_id"])
    op.create_index(op.f("ix_steel_machine_downtime_events_started_at"), "steel_machine_downtime_events", ["started_at"])

    # steel_maintenance_tasks
    op.create_table(
        "steel_maintenance_tasks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("org_id", sa.String(), nullable=False),
        sa.Column("factory_id", sa.String(), nullable=False),
        sa.Column("machine_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.String(length=500), nullable=True),
        sa.Column("maintenance_type", sa.String(length=20), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("priority", sa.String(length=12), nullable=False),
        sa.Column("scheduled_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("assigned_to_user_id", sa.Integer(), nullable=True),
        sa.Column("runtime_hours_trigger", sa.Float(), nullable=True),
        sa.Column("notes", sa.String(length=500), nullable=True),
        sa.Column("created_by_user_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["machine_id"], ["steel_machines.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_steel_maintenance_tasks_machine_id"), "steel_maintenance_tasks", ["machine_id"])
    op.create_index(op.f("ix_steel_maintenance_tasks_factory_id"), "steel_maintenance_tasks", ["factory_id"])
    op.create_index(op.f("ix_steel_maintenance_tasks_status"), "steel_maintenance_tasks", ["status"])


def downgrade() -> None:
    op.drop_table("steel_maintenance_tasks")
    op.drop_table("steel_machine_downtime_events")
