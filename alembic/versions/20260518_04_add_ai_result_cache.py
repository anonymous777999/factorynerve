"""Add ai_result_cache table for DB-backed AI deduplication.

Revision ID: 20260518_04
Revises: 20260518_03
Create Date: 2026-05-18
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260518_04"
down_revision = "20260518_03"
branch_labels = None
depends_on = None


def upgrade() -> None:
    json_type = postgresql.JSONB(astext_type=sa.Text()) if op.get_bind().dialect.name == "postgresql" else sa.JSON()
    op.create_table(
        "ai_result_cache",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("org_id", sa.String(length=36), nullable=False),
        sa.Column("cache_key", sa.String(length=128), nullable=False),
        sa.Column("prompt_name", sa.String(length=64), nullable=False),
        sa.Column("prompt_version", sa.String(length=32), nullable=False, server_default="v1"),
        sa.Column("result_json", json_type, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.org_id"], ondelete="CASCADE"),
    )
    op.create_index("ix_ai_result_cache_id", "ai_result_cache", ["id"], unique=False)
    op.create_index("ix_ai_result_cache_org_id", "ai_result_cache", ["org_id"], unique=False)
    op.create_index("ix_ai_result_cache_cache_key", "ai_result_cache", ["cache_key"], unique=False)
    op.create_index(
        "ix_ai_result_cache_org_cache_key",
        "ai_result_cache",
        ["org_id", "cache_key"],
        unique=True,
    )
    op.create_index("ix_ai_result_cache_expires_at", "ai_result_cache", ["expires_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_ai_result_cache_expires_at", table_name="ai_result_cache")
    op.drop_index("ix_ai_result_cache_org_cache_key", table_name="ai_result_cache")
    op.drop_index("ix_ai_result_cache_cache_key", table_name="ai_result_cache")
    op.drop_index("ix_ai_result_cache_org_id", table_name="ai_result_cache")
    op.drop_index("ix_ai_result_cache_id", table_name="ai_result_cache")
    op.drop_table("ai_result_cache")
