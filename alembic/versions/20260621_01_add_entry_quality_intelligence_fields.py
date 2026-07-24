"""add_entry_quality_intelligence_fields

Add structured quality fields to entries table:
- rejection_qty (int) — quantified rejection count
- defect_reason_id (FK → defect_reason) — categorized defect reason
- defect_reason_details (str) — additional context for the defect
- rework_required (bool) — whether rework was needed
- scrap_qty_entry (int) — scrap quantity at entry level

Enhance defect_reason table with label, is_active, created_at columns.
Seed the defect_reason lookup table with standard defect categories.

Revision ID: 20260621_01
Revises: 20260620_155021
Create Date: 2026-06-21 10:00:00.000000
"""

from __future__ import annotations

from datetime import datetime, timezone

from alembic import op
import sqlalchemy as sa


revision = "20260621_01"
down_revision = "20260620_155021"
branch_labels = None
depends_on = None


DEFECT_REASONS = [
    ("material_defect", "Material Defect", "Raw material quality issue — substandard input material"),
    ("dimensional_variance", "Dimensional Variance", "Product dimensions out of specification tolerance"),
    ("surface_defect", "Surface Defect", "Surface quality issue — cracks, scaling, pitting, or roughness"),
    ("process_deviation", "Process Deviation", "Process parameter deviation — temperature, pressure, timing"),
    ("equipment_failure", "Equipment Failure", "Machine or equipment malfunction caused the defect"),
    ("operator_error", "Operator Error", "Human error during production or handling"),
    ("rework_correction", "Rework / Correction", "Item required rework or correction to meet quality spec"),
    ("other", "Other", "Uncategorized or miscellaneous quality issue"),
]


def _table_names(bind) -> set[str]:
    return set(sa.inspect(bind).get_table_names())


def upgrade() -> None:
    bind = op.get_bind()
    table_names = _table_names(bind)

    # ── 1. Ensure defect_reason table exists ───────────────────────────
    if "defect_reason" not in table_names:
        op.create_table(
            "defect_reason",
            sa.Column("id", sa.Integer(), primary_key=True, index=True),
            sa.Column("code", sa.String(60), nullable=False, unique=True),
            sa.Column("label", sa.String(120), nullable=False, server_default=""),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("CURRENT_TIMESTAMP"),
            ),
        )
    else:
        # Add columns if table already exists
        inspector = sa.inspect(bind)
        defect_reason_columns = {col["name"] for col in inspector.get_columns("defect_reason")}

        if "label" not in defect_reason_columns:
            op.add_column("defect_reason", sa.Column("label", sa.String(120), nullable=False, server_default=""))
        if "is_active" not in defect_reason_columns:
            op.add_column("defect_reason", sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")))
        if "created_at" not in defect_reason_columns:
            op.add_column(
                "defect_reason",
                sa.Column(
                    "created_at",
                    sa.DateTime(timezone=True),
                    nullable=False,
                    server_default=sa.text("CURRENT_TIMESTAMP"),
                ),
            )

        # Backfill label from code for existing rows
        op.execute(
            "UPDATE defect_reason SET label = code WHERE label IS NULL OR label = ''"
        )

    # ── 2. Seed defect_reason data ─────────────────────────────────────
    dialect = bind.dialect.name
    now = datetime.now(timezone.utc)

    for code, label, description in DEFECT_REASONS:
        existing = bind.execute(
            sa.text("SELECT id FROM defect_reason WHERE code = :code"),
            {"code": code},
        ).fetchone()
        if existing is None:
            if dialect == "postgresql":
                bind.execute(
                    sa.text(
                        """INSERT INTO defect_reason (code, label, description, is_active, created_at)
                           VALUES (:code, :label, :description, true, :created_at)"""
                    ),
                    {"code": code, "label": label, "description": description, "created_at": now},
                )
            else:
                bind.execute(
                    sa.text(
                        """INSERT INTO defect_reason (code, label, description, is_active, created_at)
                           VALUES (:code, :label, :description, 1, :created_at)"""
                    ),
                    {"code": code, "label": label, "description": description, "created_at": now},
                )

    # ── 3. New columns on entries table ─────────────────────────────────
    if "entries" in table_names:
        inspector = sa.inspect(bind)
        entry_columns = {col["name"] for col in inspector.get_columns("entries")}

        if "rejection_qty" not in entry_columns:
            op.add_column("entries", sa.Column("rejection_qty", sa.Integer(), nullable=True))
        if "defect_reason_id" not in entry_columns:
            op.add_column("entries", sa.Column("defect_reason_id", sa.Integer(), nullable=True))
            with op.batch_alter_table("entries") as batch_op:
                batch_op.create_foreign_key(
                    "fk_entries_defect_reason_id",
                    "defect_reason",
                    ["defect_reason_id"],
                    ["id"],
                )
            op.create_index(
                "ix_entries_defect_reason_id",
                "entries",
                ["defect_reason_id"],
            )
        if "defect_reason_details" not in entry_columns:
            op.add_column("entries", sa.Column("defect_reason_details", sa.String(300), nullable=True))
        if "rework_required" not in entry_columns:
            if dialect == "postgresql":
                op.add_column(
                    "entries",
                    sa.Column("rework_required", sa.Boolean(), nullable=False, server_default=sa.text("false")),
                )
            else:
                op.add_column(
                    "entries",
                    sa.Column("rework_required", sa.Boolean(), nullable=False, server_default=sa.text("false")),
                )
        if "scrap_qty_entry" not in entry_columns:
            op.add_column("entries", sa.Column("scrap_qty_entry", sa.Integer(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    table_names = _table_names(bind)

    if "entries" in table_names:
        inspector = sa.inspect(bind)
        entry_columns = {col["name"] for col in inspector.get_columns("entries")}

        # Remove FK constraint and index first
        if "defect_reason_id" in entry_columns:
            with op.batch_alter_table("entries") as batch_op:
                batch_op.drop_constraint("fk_entries_defect_reason_id", type_="foreignkey")
            op.drop_index("ix_entries_defect_reason_id", table_name="entries")
            op.drop_column("entries", "defect_reason_id")
        for col in ("rejection_qty", "defect_reason_details", "rework_required", "scrap_qty_entry"):
            if col in entry_columns:
                op.drop_column("entries", col)

    # Only drop columns added to defect_reason, not the whole table
    if "defect_reason" in table_names:
        inspector = sa.inspect(bind)
        defect_reason_columns = {col["name"] for col in inspector.get_columns("defect_reason")}
        for col in ("created_at", "is_active"):
            if col in defect_reason_columns:
                op.drop_column("defect_reason", col)
        # For label, keep it but remove the server default; dropping it would lose data
        if "label" in defect_reason_columns:
            op.alter_column("defect_reason", "label", server_default=None)
