"""ensure_steel_lines_machines_tables

Create steel_production_lines and steel_machines tables if they were
missed during the original deployment (Alembic was stamped at head
without actually running migration 20260619_06 on production).

Revision ID: 20260623_01
Revises: b9f67568e281
Create Date: 2026-06-23 10:30:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260623_01"
down_revision = "b9f67568e281"
branch_labels = None
depends_on = None


def _table_names(bind) -> set[str]:
    return set(sa.inspect(bind).get_table_names())


def upgrade() -> None:
    bind = op.get_bind()
    table_names = _table_names(bind)

    # ── 1. SteelProductionLines ───────────────────────────────────────
    if "steel_production_lines" not in table_names:
        op.create_table(
            "steel_production_lines",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("org_id", sa.String(), nullable=False),
            sa.Column("factory_id", sa.String(), nullable=False),
            sa.Column("name", sa.String(100), nullable=False),
            sa.Column("code", sa.String(24), nullable=True),
            sa.Column("description", sa.String(300), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("1")),
            sa.Column("created_by_user_id", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["org_id"], ["organizations.org_id"]),
            sa.ForeignKeyConstraint(["factory_id"], ["factories.factory_id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "factory_id", "name", name="uq_steel_production_lines_factory_name"
            ),
        )
        op.create_index(
            "ix_steel_production_lines_factory_id",
            "steel_production_lines",
            ["factory_id"],
        )

    # ── 2. SteelMachines ──────────────────────────────────────────────
    if "steel_machines" not in table_names:
        op.create_table(
            "steel_machines",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("org_id", sa.String(), nullable=False),
            sa.Column("factory_id", sa.String(), nullable=False),
            sa.Column("line_id", sa.Integer(), nullable=True),
            sa.Column("machine_code", sa.String(24), nullable=False),
            sa.Column("name", sa.String(160), nullable=False),
            sa.Column("machine_type", sa.String(60), nullable=True),
            sa.Column("description", sa.String(300), nullable=True),
            sa.Column("rated_capacity_per_hour", sa.Float(), nullable=True),
            # OEE tracking fields (added by migration 20260620_155021)
            sa.Column("planned_runtime_minutes", sa.Float(), nullable=True),
            sa.Column("operating_runtime_minutes", sa.Float(), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("1")),
            sa.Column("created_by_user_id", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["org_id"], ["organizations.org_id"]),
            sa.ForeignKeyConstraint(["factory_id"], ["factories.factory_id"]),
            sa.ForeignKeyConstraint(["line_id"], ["steel_production_lines.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "factory_id", "machine_code", name="uq_steel_machines_factory_code"
            ),
        )
        op.create_index(
            "ix_steel_machines_factory_id",
            "steel_machines",
            ["factory_id"],
        )


def downgrade() -> None:
    bind = op.get_bind()
    table_names = _table_names(bind)
    for table in ("steel_machines", "steel_production_lines"):
        if table in table_names:
            op.drop_table(table)
