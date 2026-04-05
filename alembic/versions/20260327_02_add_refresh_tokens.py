"""Add refresh_tokens table.

Revision ID: 20260327_02
Revises: 20260327_01
Create Date: 2026-03-27
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260327_02"
down_revision = "20260327_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "refresh_tokens",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("org_id", sa.String(length=36), nullable=True),
        sa.Column("factory_id", sa.String(length=36), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.org_id"]),
        sa.ForeignKeyConstraint(["factory_id"], ["factories.factory_id"]),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index("ix_refresh_tokens_token_hash", "refresh_tokens", ["token_hash"], unique=False)
    op.create_index("ix_refresh_tokens_user_id", "refresh_tokens", ["user_id"], unique=False)
    op.create_index("ix_refresh_tokens_org_id", "refresh_tokens", ["org_id"], unique=False)
    op.create_index("ix_refresh_tokens_factory_id", "refresh_tokens", ["factory_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_refresh_tokens_factory_id", table_name="refresh_tokens")
    op.drop_index("ix_refresh_tokens_org_id", table_name="refresh_tokens")
    op.drop_index("ix_refresh_tokens_user_id", table_name="refresh_tokens")
    op.drop_index("ix_refresh_tokens_token_hash", table_name="refresh_tokens")
    op.drop_table("refresh_tokens")
