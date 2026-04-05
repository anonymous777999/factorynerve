"""Add org-level usage tracking tables.

Revision ID: 20260327_01
Revises: None
Create Date: 2026-03-27
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260327_01"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "org_feature_usage",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("org_id", sa.String(length=36), nullable=False),
        sa.Column("period", sa.String(length=7), nullable=False),
        sa.Column("feature", sa.String(length=32), nullable=False),
        sa.Column("request_count", sa.Integer(), nullable=False),
        sa.Column("last_request_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_org_feature_usage_org_period_feature",
        "org_feature_usage",
        ["org_id", "period", "feature"],
        unique=True,
    )

    op.create_table(
        "org_ocr_usage",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("org_id", sa.String(length=36), nullable=False),
        sa.Column("period", sa.String(length=7), nullable=False),
        sa.Column("request_count", sa.Integer(), nullable=False),
        sa.Column("credit_count", sa.Integer(), nullable=False),
        sa.Column("last_request_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_org_ocr_usage_org_period", "org_ocr_usage", ["org_id", "period"], unique=True)
    op.create_index("ix_org_ocr_usage_id", "org_ocr_usage", ["id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_org_ocr_usage_id", table_name="org_ocr_usage")
    op.drop_index("ix_org_ocr_usage_org_period", table_name="org_ocr_usage")
    op.drop_table("org_ocr_usage")
    op.drop_index("ix_org_feature_usage_org_period_feature", table_name="org_feature_usage")
    op.drop_table("org_feature_usage")
