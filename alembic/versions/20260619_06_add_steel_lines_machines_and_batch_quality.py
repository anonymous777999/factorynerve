"""add_steel_lines_machines_and_batch_quality

Revision ID: 20260619_06
Revises: 20260619_05
Create Date: 2026-06-19 19:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260619_06"
down_revision = "20260619_05"
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
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("created_by_user_id", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["org_id"], ["organizations.org_id"],),
            sa.ForeignKeyConstraint(["factory_id"], ["factories.factory_id"],),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("factory_id", "name", name="uq_steel_production_lines_factory_name"),
        )
        op.create_index("ix_steel_production_lines_factory_id", "steel_production_lines", ["factory_id"])

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
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("created_by_user_id", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["org_id"], ["organizations.org_id"],),
            sa.ForeignKeyConstraint(["factory_id"], ["factories.factory_id"],),
            sa.ForeignKeyConstraint(["line_id"], ["steel_production_lines.id"],),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("factory_id", "machine_code", name="uq_steel_machines_factory_code"),
        )
        op.create_index("ix_steel_machines_factory_id", "steel_machines", ["factory_id"])

    # ── 3. New columns on steel_production_batches ────────────────────
    inspector = sa.inspect(bind)
    columns = {col["name"] for col in inspector.get_columns("steel_production_batches")}

    if "rejection_qty_kg" not in columns:
        op.add_column("steel_production_batches", sa.Column("rejection_qty_kg", sa.Float(), nullable=True))
    if "scrap_qty_kg" not in columns:
        op.add_column("steel_production_batches", sa.Column("scrap_qty_kg", sa.Float(), nullable=True))
    if "line_id" not in columns:
        op.add_column("steel_production_batches", sa.Column("line_id", sa.Integer(), nullable=True))
        with op.batch_alter_table("steel_production_batches") as batch_op:
            batch_op.create_foreign_key(
                "fk_steel_production_batches_line_id",
                "steel_production_lines",
                ["line_id"],
                ["id"],
            )
    if "machine_id" not in columns:
        op.add_column("steel_production_batches", sa.Column("machine_id", sa.Integer(), nullable=True))
        with op.batch_alter_table("steel_production_batches") as batch_op:
            batch_op.create_foreign_key(
                "fk_steel_production_batches_machine_id",
                "steel_machines",
                ["machine_id"],
                ["id"],
            )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {col["name"] for col in inspector.get_columns("steel_production_batches")}

    # Remove FK constraints first
    if "machine_id" in columns:
        op.drop_constraint("fk_steel_production_batches_machine_id", "steel_production_batches", type_="foreignkey")
        op.drop_column("steel_production_batches", "machine_id")
    if "line_id" in columns:
        op.drop_constraint("fk_steel_production_batches_line_id", "steel_production_batches", type_="foreignkey")
        op.drop_column("steel_production_batches", "line_id")
    for col in ("scrap_qty_kg", "rejection_qty_kg"):
        if col in columns:
            op.drop_column("steel_production_batches", col)

    table_names = _table_names(bind)
    for table in ("steel_machines", "steel_production_lines"):
        if table in table_names:
            op.drop_table(table)
