"""Add ai_usage_log table and organization AI budget caps.

Revision ID: 20260518_05
Revises: 20260518_04
Create Date: 2026-05-18
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260518_05"
down_revision = "20260518_04"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "organizations",
        sa.Column("ai_daily_token_cap", sa.Integer(), nullable=False, server_default="250000"),
    )
    op.add_column(
        "organizations",
        sa.Column("ai_monthly_cost_cap_usd", sa.Float(), nullable=False, server_default="250"),
    )
    op.create_table(
        "ai_usage_log",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("org_id", sa.String(length=36), nullable=False),
        sa.Column("pipeline_name", sa.String(length=64), nullable=False),
        sa.Column("prompt_name", sa.String(length=64), nullable=False),
        sa.Column("prompt_version", sa.String(length=32), nullable=False, server_default="v1"),
        sa.Column("model", sa.String(length=128), nullable=False),
        sa.Column("input_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("output_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("estimated_cost_usd", sa.Float(), nullable=False, server_default="0"),
        sa.Column("cache_hit", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("success", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("latency_ms", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.org_id"], ondelete="CASCADE"),
    )
    op.create_index("ix_ai_usage_log_id", "ai_usage_log", ["id"], unique=False)
    op.create_index("ix_ai_usage_log_org_id", "ai_usage_log", ["org_id"], unique=False)
    op.create_index("ix_ai_usage_log_pipeline_name", "ai_usage_log", ["pipeline_name"], unique=False)
    op.create_index("ix_ai_usage_log_prompt_name", "ai_usage_log", ["prompt_name"], unique=False)
    op.create_index("ix_ai_usage_log_org_created_at", "ai_usage_log", ["org_id", "created_at"], unique=False)
    op.create_index("ix_ai_usage_log_org_pipeline", "ai_usage_log", ["org_id", "pipeline_name"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_ai_usage_log_org_pipeline", table_name="ai_usage_log")
    op.drop_index("ix_ai_usage_log_org_created_at", table_name="ai_usage_log")
    op.drop_index("ix_ai_usage_log_prompt_name", table_name="ai_usage_log")
    op.drop_index("ix_ai_usage_log_pipeline_name", table_name="ai_usage_log")
    op.drop_index("ix_ai_usage_log_org_id", table_name="ai_usage_log")
    op.drop_index("ix_ai_usage_log_id", table_name="ai_usage_log")
    op.drop_table("ai_usage_log")
    op.drop_column("organizations", "ai_monthly_cost_cap_usd")
    op.drop_column("organizations", "ai_daily_token_cap")
